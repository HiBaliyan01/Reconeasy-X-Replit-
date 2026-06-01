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
  run_id?: string;
};

type LogisticsResult = {
  order_id: string;
  weight_grams: number;
  expected_logistics: number;
  actual_logistics: number;
  discrepancy: number;
  status: "MATCHED" | "OVERCHARGED" | "UNDERCHARGED";
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
  let isOrchestrated = false;

  try {
    const body = (await req.json()) as InputBody;
    const tenantId = (body.tenant_id ?? "").trim();
    const marketplace = (body.marketplace ?? "").trim().toLowerCase();
    const settlementId = (body.settlement_id ?? "").trim();
    const externalRunId = (body.run_id ?? "").trim();
    isOrchestrated = Boolean(externalRunId);

    if (!tenantId || !marketplace || !settlementId) {
      return new Response(
        JSON.stringify({ message: "tenant_id, marketplace, settlement_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (externalRunId) {
      runId = externalRunId;
    } else {
      const { data: runInsert, error: runInsertError } = await client
        .from("reconciliation_runs")
        .insert({
          tenant_id: tenantId,
          marketplace,
          settlement_id: settlementId,
          status: "STARTED",
          trigger_type: "LOGISTICS",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single<{ id: string }>();

      if (runInsertError || !runInsert) {
        throw new Error(`Failed to create run: ${runInsertError?.message || "unknown"}`);
      }
      runId = runInsert.id;
    }

    const { data: feeLines, error: feeLinesError } = await client
      .from("settlement_fee_lines")
      .select("order_id, amount")
      .eq("tenant_id", tenantId)
      .eq("marketplace", marketplace)
      .eq("settlement_id", settlementId)
      .eq("bucket", "LOGISTICS")
      .eq("transaction_type", "Order");

    if (feeLinesError) {
      throw new Error(`Failed to fetch settlement fee lines: ${feeLinesError.message}`);
    }

    const actualByOrder = new Map<string, number>();
    for (const row of feeLines ?? []) {
      const orderId = String((row as { order_id: string }).order_id ?? "");
      if (!orderId) continue;
      const amount = Math.abs(toNumber((row as { amount: number | string }).amount));
      actualByOrder.set(orderId, (actualByOrder.get(orderId) ?? 0) + amount);
    }

    const orderIds = [...actualByOrder.keys()];
    if (orderIds.length === 0) {
      if (!isOrchestrated) {
        await client
          .from("reconciliation_runs")
          .update({
            status: "COMPLETED",
            completed_at: new Date().toISOString(),
            total_orders_processed: 0,
            affected_orders_count: 0,
          })
          .eq("id", runId);
      }

      return new Response(
        JSON.stringify({
          run_id: runId,
          status: "COMPLETED",
          orders_processed: 0,
          orders_skipped_no_weight: 0,
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: activeRateCard, error: rateCardError } = await client
      .from("rate_cards_v2")
      .select("id")
      .eq("platform_id", marketplace)
      .eq("archived", false)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single<{ id: string }>();

    if (rateCardError || !activeRateCard) {
      throw new Error(`No active rate card found for marketplace ${marketplace}`);
    }

    const rateCardId = activeRateCard.id;

    const { data: slabs, error: slabsError } = await client
      .from("rate_card_logistics_slabs")
      .select("weight_min_grams, weight_max_grams, forward_fee, service_level")
      .eq("rate_card_id", rateCardId)
      .eq("marketplace", marketplace)
      .eq("zone", "national");

    if (slabsError) {
      throw new Error(`Failed to fetch logistics slabs: ${slabsError.message}`);
    }

    const normalizedSlabs = (slabs ?? [])
      .map((s) => ({
        min: Number((s as { weight_min_grams: number }).weight_min_grams),
        max: Number((s as { weight_max_grams: number }).weight_max_grams),
        serviceLevel: String((s as { service_level?: string }).service_level ?? "standard"),
        forwardFee: toNumber((s as { forward_fee: number | string }).forward_fee),
      }))
      .sort((a, b) => a.min - b.min);

    const { data: orders, error: ordersError } = await client
      .from("orders")
      .select("order_id, sku, weight_grams")
      .eq("brand_id", tenantId)
      .eq("marketplace", marketplace)
      .in("order_id", orderIds);

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    const skuList = [
      ...new Set(
        (orders ?? [])
          .map((o) => String((o as { sku?: string }).sku ?? ""))
          .filter(Boolean),
      ),
    ];

    const { data: products, error: productsError } = await client
      .from("products")
      .select("internal_sku, weight_grams")
      .eq("tenant_id", tenantId)
      .in("internal_sku", skuList.length > 0 ? skuList : ["__no_sku__"]);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    const productWeightBySku = new Map<string, number>();
    for (const p of products ?? []) {
      productWeightBySku.set(
        String((p as { internal_sku: string }).internal_sku),
        toNumber((p as { weight_grams?: number | string }).weight_grams),
      );
    }

    const orderById = new Map<
      string,
      { order_id: string; sku?: string; weight_grams?: number | string }
    >();
    for (const o of orders ?? []) {
      orderById.set(String((o as { order_id: string }).order_id), o as {
        order_id: string;
        sku?: string;
        weight_grams?: number | string;
      });
    }

    const results: LogisticsResult[] = [];
    let skippedNoWeight = 0;

    for (const orderId of orderIds) {
      const order = orderById.get(orderId);
      const orderWeight = toNumber(order?.weight_grams);
      const productWeight = order?.sku ? toNumber(productWeightBySku.get(order.sku)) : 0;
      const resolvedWeight = orderWeight > 0 ? orderWeight : productWeight > 0 ? productWeight : 0;

      if (!resolvedWeight) {
        skippedNoWeight += 1;
        continue;
      }

      const slab = normalizedSlabs.find(
        (s) =>
          s.serviceLevel === "standard" &&
          s.min <= resolvedWeight &&
          s.max >= resolvedWeight,
      ) ??
        normalizedSlabs.find((s) => s.min <= resolvedWeight && s.max >= resolvedWeight);

      if (!slab) {
        continue;
      }

      const expectedLogistics = slab.forwardFee;
      const actualLogistics = actualByOrder.get(orderId) ?? 0;
      const discrepancy = expectedLogistics - actualLogistics;

      let status: LogisticsResult["status"] = "MATCHED";
      if (Math.abs(discrepancy) > 0.01) {
        status = actualLogistics > expectedLogistics ? "OVERCHARGED" : "UNDERCHARGED";
      }

      results.push({
        order_id: orderId,
        weight_grams: resolvedWeight,
        expected_logistics: expectedLogistics,
        actual_logistics: actualLogistics,
        discrepancy,
        status,
      });
    }

    const batchSize = 500;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      const feeRows = batch.map((r) => ({
        tenant_id: tenantId,
        run_id: runId,
        order_id: r.order_id,
        marketplace,
        bucket: "LOGISTICS",
        expected_amount: r.expected_logistics,
        actual_amount: r.actual_logistics,
      }));

      const { error: feeUpsertError } = await client
        .from("reconciliation_fee_components")
        .upsert(feeRows, {
          onConflict: "tenant_id,marketplace,run_id,order_id,bucket",
        });

      if (feeUpsertError) {
        throw new Error(`Failed to upsert reconciliation_fee_components: ${feeUpsertError.message}`);
      }

      if (!isOrchestrated) {
        const orderRows = batch.map((r) => ({
          tenant_id: tenantId,
          marketplace,
          run_id: runId,
          order_id: r.order_id,
          // Keep commission fields present to satisfy existing NOT NULL constraints.
          expected_commission: 0,
          actual_commission: 0,
          status: "MATCHED",
          expected_logistics: r.expected_logistics,
          actual_logistics: r.actual_logistics,
          logistics_discrepancy: r.discrepancy,
          logistics_status: r.status,
        }));

        const { error: orderUpsertError } = await client
          .from("reconciliation_order_summary")
          .upsert(orderRows, { onConflict: "run_id,order_id" });

        if (orderUpsertError) {
          throw new Error(`Failed to upsert reconciliation_order_summary: ${orderUpsertError.message}`);
        }
      }
    }

    if (!isOrchestrated) {
      const { error: completeError } = await client
        .from("reconciliation_runs")
        .update({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
          total_orders_processed: results.length,
          affected_orders_count: results.filter((r) => r.status !== "MATCHED").length,
        })
        .eq("id", runId);

      if (completeError) {
        throw new Error(`Failed to update run status: ${completeError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        run_id: runId,
        status: "COMPLETED",
        orders_processed: results.length,
        orders_skipped_no_weight: skippedNoWeight,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (runId && !isOrchestrated) {
      await client
        .from("reconciliation_runs")
        .update({
          status: "FAILED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        run_id: runId,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
