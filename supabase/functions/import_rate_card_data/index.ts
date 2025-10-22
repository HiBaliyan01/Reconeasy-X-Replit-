import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type IssuesPayload = {
  mapped?: string[];
  missing_mandatory?: string[];
  unmapped?: string[];
} | null;

type Payload = {
  template_type: "flat" | "tiered";
  version: string;
  file_name: string;
  uploaded_by?: string | null;
  data: unknown;
  issues?: IssuesPayload;
  validation_status?: "success" | "warning" | "failed";
};

const asRecordArray = (value: unknown): Array<Record<string, unknown>> | null => {
  if (!Array.isArray(value)) return null;
  const sanitized: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    sanitized.push(item as Record<string, unknown>);
  }
  return sanitized;
};

const normalizeIssues = (issues: IssuesPayload): IssuesPayload => {
  if (!issues || typeof issues !== "object") return null;
  const cleaned: IssuesPayload = {};
  if (Array.isArray(issues.mapped)) cleaned.mapped = issues.mapped.map(String);
  if (Array.isArray(issues.missing_mandatory)) cleaned.missing_mandatory = issues.missing_mandatory.map(String);
  if (Array.isArray(issues.unmapped)) cleaned.unmapped = issues.unmapped.map(String);
  return cleaned;
};

const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ status: "error", message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ status: "error", message: "Supabase credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload: Payload | null = null;
    try {
      payload = (await req.json()) as Payload;
    } catch (parseError) {
      return new Response(
        JSON.stringify({ status: "error", message: "Invalid or missing JSON payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ status: "error", message: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { template_type, version, file_name } = payload;
    const sanitizedData = asRecordArray(payload.data);

    if (!template_type || !version || !file_name || !sanitizedData) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "template_type, version, file_name, and data (array of objects) are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: record, error } = await supabase
      .from("rate_card_data")
      .insert({
        rate_card_template_type: template_type,
        rate_card_version: version,
        uploaded_by: payload.uploaded_by ?? null,
        file_name,
        data: sanitizedData,
        validation_status:
          payload.validation_status ?? (Array.isArray(payload.issues?.missing_mandatory) && payload.issues!.missing_mandatory!.length
            ? "warning"
            : "success"),
        issues: normalizeIssues(payload.issues ?? null),
        status: "imported",
        record_count: sanitizedData.length,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "42P01") {
        return new Response(JSON.stringify({ status: "error", message: "rate_card_data table not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorMessage = error.message || error.details || error.hint || "Database insert failed";
      console.error("import_rate_card_data insert error", error);
      return new Response(
        JSON.stringify({ status: "error", message: errorMessage, code: error.code ?? null, details: error }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ status: "success", record_id: record?.id ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("import_rate_card_data unexpected error", error);
    const message = error instanceof Error && error.message ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ status: "error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handleRequest);
