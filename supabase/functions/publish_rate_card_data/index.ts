import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type PublishPayload = {
  upload_id: string;
  activate?: boolean;
};

type RateCardRow = Record<string, unknown>;

type RateCardDataRecord = {
  id: string;
  rate_card_template_type: "flat" | "tiered";
  rate_card_version: string;
  uploaded_by: string | null;
  data: RateCardRow[];
  validation_status: string | null;
};

const REQUIRED_FIELDS = [
  "Marketplace",
  "Category",
  "Commission Type",
  "Effective From",
];

const safeString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};

const safeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ""));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const toDate = (value: unknown): string | null => {
  const str = safeString(value);
  if (!str) return null;
  const iso = new Date(str);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString().slice(0, 10);
};

const normalizeCommissionType = (value: unknown): "flat" | "tiered" => {
  const str = (safeString(value) ?? "flat").toLowerCase();
  return str.includes("tier") ? "tiered" : "flat";
};

const normalizeRow = (row: RateCardRow) => {
  const marketplace = safeString(row["Marketplace"]);
  const category = safeString(row["Category"]);
  const commissionType = normalizeCommissionType(row["Commission Type"]);
  const commissionPercent = safeNumber(row["Commission %"]);
  const effectiveFrom = toDate(row["Effective From"]);
  const effectiveTo = toDate(row["Effective To"]);

  if (!marketplace || !category || !effectiveFrom) {
    return null;
  }

  return {
    platform_id: marketplace.toLowerCase(),
    category_id: category.toLowerCase(),
    commission_type: commissionType,
    commission_percent: commissionPercent,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    status: "active",
    notes: safeString(row["Notes"]),
    min_price: safeNumber(row["Min Price (₹)"]),
    max_price: safeNumber(row["Max Price (₹)"]),
    settlement_basis: safeString(row["Settlement Basis"])?.toLowerCase() ?? "order",
    t_plus_days: safeNumber(row["T + Days"]) ?? 0,
    gst_percent: safeNumber(row["GST %"]) ?? 18,
    tcs_percent: safeNumber(row["TCS %"]) ?? 1,
    uploaded_metadata: row,
  };
};

const buildOverlapRangeFilter = (
  rows: ReturnType<typeof normalizeRow>[],
  templateType: "flat" | "tiered"
) => {
  const uniquePairs = new Map<string, { min: string; max: string | null }>();
  rows
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .forEach((row) => {
      const key = `${row.platform_id}__${row.category_id}`;
      const existing = uniquePairs.get(key);
      const min = row.effective_from;
      const max = row.effective_to;
      if (!existing) {
        uniquePairs.set(key, { min, max });
        return;
      }
      if (min < existing.min) existing.min = min;
      if (existing.max === null || (max && existing.max && max > existing.max)) {
        existing.max = max;
      }
    });

  return { uniquePairs, templateType };
};

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { status: "error", message: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(500, { status: "error", message: "Supabase credentials not configured" });
  }

  let payload: PublishPayload;
  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return respond(400, { status: "error", message: "Invalid JSON payload" });
  }

  const uploadId = safeString(payload?.upload_id);
  if (!uploadId) {
    return respond(400, { status: "error", message: "upload_id is required" });
  }
  const activate = Boolean(payload?.activate);

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: uploadRecord, error: fetchError } = await supabase
      .from("rate_card_data")
      .select("id, rate_card_template_type, rate_card_version, uploaded_by, data, validation_status, status")
      .eq("id", uploadId)
      .maybeSingle<RateCardDataRecord & { status?: string | null }>();

    if (fetchError) {
      console.error("publish_rate_card_data fetch error", fetchError);
      return respond(500, { status: "error", message: fetchError.message });
    }

    if (!uploadRecord) {
      return respond(404, { status: "error", message: "Upload not found" });
    }

    if (!Array.isArray(uploadRecord.data) || !uploadRecord.data.length) {
      return respond(400, { status: "error", message: "Upload has no data rows" });
    }

    const normalizedRows = uploadRecord.data
      .map(normalizeRow)
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!normalizedRows.length) {
      const sampleKeys = Object.keys((uploadRecord.data[0] ?? {}) as Record<string, unknown>).join(", ");
      return respond(400, {
        status: "error",
        message: "No valid rows to publish. Ensure required columns exist.",
        sample_keys: sampleKeys,
      });
    }

    const { uniquePairs } = buildOverlapRangeFilter(normalizedRows, uploadRecord.rate_card_template_type);

    if (activate) {
      for (const [key] of uniquePairs.entries()) {
        const [platformId, categoryId] = key.split("__");
        const { error } = await supabase
          .from("rate_cards_v2")
          .update({ archived: true })
          .match({ platform_id: platformId, category_id: categoryId, archived: false });
        if (error) {
          console.error("publish_rate_card_data archive error", error);
          return respond(400, { status: "error", message: error.message, code: error.code });
        }
      }
    }

    const rowsToInsert = normalizedRows.map((row) => ({
      platform_id: row.platform_id,
      category_id: row.category_id,
      commission_type: row.commission_type,
      commission_percent: row.commission_percent,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      notes: row.notes,
      global_min_price: row.min_price,
      global_max_price: row.max_price,
      gst_percent: row.gst_percent,
      tcs_percent: row.tcs_percent,
      settlement_basis: row.settlement_basis,
      t_plus_days: row.t_plus_days,
      archived: false,
      template_type: uploadRecord.rate_card_template_type,
      template_version: uploadRecord.rate_card_version ?? "v3.2",
      uploaded_by: uploadRecord.uploaded_by ?? "system",
      source_upload_id: uploadRecord.id,
      raw_payload: row.uploaded_metadata,
    }));

    for (const row of normalizedRows) {
      const deleteFilters: Record<string, unknown> = {
        platform_id: row!.platform_id,
        category_id: row!.category_id,
        commission_type: row!.commission_type,
        effective_from: row!.effective_from,
        effective_to: row!.effective_to,
      };
      if (row!.commission_type === "flat" && row!.commission_percent !== null) {
        deleteFilters.commission_percent = row!.commission_percent;
      }
      const { error: deleteError } = await supabase
        .from("rate_cards_v2")
        .delete()
        .match(deleteFilters);
      if (deleteError) {
        console.error("publish_rate_card_data delete conflict error", deleteError);
        return respond(400, { status: "error", message: deleteError.message, code: deleteError.code });
      }
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from("rate_cards_v2")
      .insert(rowsToInsert)
      .select("id");

    if (insertError) {
      console.error("publish_rate_card_data insert error", insertError);
      return respond(400, { status: "error", message: insertError.message, code: insertError.code });
    }

    const { error: updateError } = await supabase
      .from("rate_card_data")
      .update({ status: "published", record_count: normalizedRows.length })
      .eq("id", uploadRecord.id);

    if (updateError) {
      console.error("publish_rate_card_data status update error", updateError);
      return respond(400, { status: "error", message: updateError.message, code: updateError.code });
    }

    return respond(200, {
      status: "success",
      published: insertedRows?.length ?? normalizedRows.length,
      upload_id: uploadRecord.id,
    });
  } catch (error) {
    console.error("publish_rate_card_data unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respond(500, { status: "error", message });
  }
});
