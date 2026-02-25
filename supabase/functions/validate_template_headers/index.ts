import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type TemplateField = {
  label: string;
  aliases?: string[];
  mandatory?: boolean;
};

type RequestPayload = {
  headers_list: string[];
  template_type: string;
  header_rows?: string[][];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ status: "error", message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { headers_list, template_type, header_rows } = (await req.json()) as RequestPayload;
    if (!Array.isArray(headers_list) || typeof template_type !== "string") {
      throw new Error("Invalid request payload");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("rate_card_templates")
      .select("headers_json, version")
      .eq("template_type", template_type)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      throw new Error("Active template not found for " + template_type);
    }

    const templateHeaders = (data.headers_json ?? []) as TemplateField[];

    const normalizeRow = (row: string[]): string[] =>
      row
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);

    const isInstructionRow = (row: string[]): boolean => {
      if (!row.length) return true;
      const joined = row.join(" ").toLowerCase();
      return joined.includes("fields marked") || joined.includes("do not change header names");
    };

    const candidates: string[][] = [];

    if (Array.isArray(headers_list) && headers_list.length) {
      candidates.push(normalizeRow(headers_list));
    }

    if (Array.isArray(header_rows)) {
      for (const row of header_rows) {
        if (Array.isArray(row)) {
          candidates.push(normalizeRow(row));
        }
      }
    }

    if (!candidates.length && headers_list.length === 1) {
      const derived = headers_list[0].split(",");
      candidates.push(normalizeRow(derived));
    }

    const normalizedCandidates = candidates.map((row) => normalizeRow(row)).filter((row) => row.length > 0);
    const usableCandidates = normalizedCandidates.filter((row) => !isInstructionRow(row));

    const scoredCandidates = usableCandidates
      .map((row) => {
        const normalized = row.map((value) => value.toLowerCase());
        let matches = 0;
        let mandatoryMatches = 0;
        for (const field of templateHeaders) {
          const aliases = [field.label, ...(field.aliases ?? [])].map((alias) => alias.toLowerCase());
          if (normalized.some((value) => aliases.includes(value))) {
            matches += 1;
            if (field.mandatory) mandatoryMatches += 1;
          }
        }
        return { normalized, matches, mandatoryMatches };
      })
      .filter((candidate) => candidate.matches > 0);

    const bestCandidate = scoredCandidates.sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      if (b.mandatoryMatches !== a.mandatoryMatches) return b.mandatoryMatches - a.mandatoryMatches;
      return b.normalized.length - a.normalized.length;
    })[0];

    const fallbackRow = usableCandidates[0] ?? normalizedCandidates[0] ?? [];
    const incoming = (bestCandidate?.normalized ?? fallbackRow.map((value) => value.toLowerCase())).map((value) =>
      value.toLowerCase()
    );

    const mapped: string[] = [];
    const unmapped: string[] = [];
    const missingMandatory: string[] = [];

    for (const field of templateHeaders) {
      if (!field?.label) continue;
      const aliases = [field.label, ...(field.aliases ?? [])].map((x) => x.toLowerCase());
      const matched = incoming.find((h) => aliases.includes(h));
      if (matched) {
        mapped.push(field.label);
      } else if (field.mandatory) {
        missingMandatory.push(field.label);
      } else {
        unmapped.push(field.label);
      }
    }

    return new Response(
      JSON.stringify({
        status: missingMandatory.length ? "error" : "success",
        mapped,
        unmapped,
        missing_mandatory: missingMandatory,
        template_version: data.version,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ status: "error", message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
