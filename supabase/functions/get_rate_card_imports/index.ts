import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

type RateCardImportRecord = {
  id: string;
  file_name: string | null;
  rate_card_template_type: string | null;
  rate_card_version: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  validation_status: string | null;
  data: unknown;
  issues: unknown;
  status?: string | null;
  record_count?: number | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ status: "error", message: "Supabase credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("rate_card_data")
      .select(
        "id, file_name, rate_card_template_type, rate_card_version, uploaded_by, uploaded_at, validation_status, data, issues, status, record_count"
      )
      .order("uploaded_at", { ascending: false })
      .limit(20);

    if (error) {
      if ((error as { code?: string })?.code === "42P01") {
        return new Response(
          JSON.stringify({ status: "success", imports: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(error.message);
    }

    const imports = (data ?? []).map((record: RateCardImportRecord) => ({
      id: record.id,
      file_name: record.file_name,
      template_type: record.rate_card_template_type,
      version: record.rate_card_version,
      uploaded_by: record.uploaded_by,
      uploaded_at: record.uploaded_at,
      validation_status: record.validation_status,
      rows: Array.isArray(record.data) ? record.data.length : 0,
      issues: record.issues ?? null,
      status: record.status ?? null,
      record_count: record.record_count ?? (Array.isArray(record.data) ? record.data.length : 0),
    }));

    return new Response(
      JSON.stringify({ status: "success", imports }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ status: "error", message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
