import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type InputBody = {
  tenant_id?: string;
  marketplace?: string;
  settlement_id?: string;
};

type RunRow = { id: string };

type RecoRow = {
  tenant_id: string;
  marketplace: string;
  order_id: string;
  expected_commission: number | string;
  actual_commission: number | string;
  status: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl =
    Deno.env.get("PROJECT_URL") ??
    Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("VITE_SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ message: "Supabase credentials are not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  let runId: string | null = null;

  try {
    const body = (await req.json()) as InputBody;
    const tenantId = (body.tenant_id ?? "").trim();
    const marketplace = (body.marketplace ?? "").trim().toLowerCase();
    const settlementId = (body.settlement_id ?? "").trim();

    if (!tenantId || !marketplace || !settlementId) {
      return new Response(
        JSON.stringify({ message: "tenant_id, marketplace, settlement_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: runInsert, error: runInsertError } = await client
      .from("reconciliation_runs")
      .insert({
        tenant_id: tenantId,
        marketplace,
        settlement_id: settlementId,
        status: "STARTED",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single<RunRow>();

    if (runInsertError || !runInsert) {
      throw new Error(`Failed to create run: ${runInsertError?.message || "unknown"}`);
    }

    runId = runInsert.id;

    const { data: computedRows, error: computeError } = await client.rpc(
      "compute_reconciliation_commission",
      {
        p_tenant_id: tenantId,
        p_marketplace: marketplace,
        p_settlement_id: settlementId,
      },
    );

    if (computeError) {
      throw new Error(`Failed to compute reconciliation: ${computeError.message}`);
    }

    const rows = (computedRows ?? []) as RecoRow[];

    if (rows.length > 0) {
      const insertRows = rows.map((r) => ({
        tenant_id: r.tenant_id,
        marketplace: r.marketplace,
        run_id: runId,
        order_id: r.order_id,
        expected_commission: toNumber(r.expected_commission),
        actual_commission: toNumber(r.actual_commission),
        status: r.status,
      }));

      const batchSize = 500;
      for (let i = 0; i < insertRows.length; i += batchSize) {
        const batch = insertRows.slice(i, i + batchSize);
        const { error: insertError } = await client
          .from("reconciliation_order_summary")
          .insert(batch);

        if (insertError) {
          throw new Error(`Failed to insert reconciliation_order_summary batch at ${i}: ${insertError.message}`);
        }
      }
    }

    const { error: completeError } = await client
      .from("reconciliation_runs")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", runId);

    if (completeError) {
      throw new Error(`Failed to update run status to COMPLETED: ${completeError.message}`);
    }

    const results = rows.map((r) => {
      const expected = toNumber(r.expected_commission);
      const actual = toNumber(r.actual_commission);
      return {
        order_id: r.order_id,
        expected,
        actual,
        discrepancy: expected - actual,
        status: r.status,
      };
    });

    return new Response(
      JSON.stringify({
        run_id: runId,
        orders_processed: results.length,
        status: "COMPLETED",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (runId) {
      await client
        .from("reconciliation_runs")
        .update({ status: "FAILED", completed_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : "Unknown error",
        run_id: runId,
        status: "FAILED",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
