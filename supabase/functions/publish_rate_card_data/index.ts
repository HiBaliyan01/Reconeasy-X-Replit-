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
  action?: "replace_existing" | "trim_existing" | "publish" | "detect";
  cross_marketplace?: boolean;
};

type RateCardRow = Record<string, unknown>;

type RateCardDataRecord = {
  id: string;
  rate_card_template_type: "flat" | "tiered";
  rate_card_version: string;
  uploaded_by: string | null;
  data: RateCardRow[];
  validation_status: string | null;
  status?: string | null;
  issues?: Record<string, unknown> | null;
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
    display_marketplace: marketplace,
    display_category: category,
    uploaded_metadata: row,
  };
};

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const jsonSafeClone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

type ConflictItem = {
  existing_id: string;
  existing_platform: string | null;
  existing_category: string | null;
  existing_range: string;
  existing_rate: { commission_type: string | null; commission_percent: number | null };
  existing_status: string;
  existing_version: string | null;
  new_platform: string;
  new_category: string;
  new_range: string;
  new_rate: { commission_type: string | null; commission_percent: number | null };
  version_mismatch: boolean;
};

const formatRange = (from: string | null, to: string | null) => {
  const start = from ?? "open";
  const end = to ?? "open";
  return `${start} → ${end}`;
};

const computeStatus = (from: string | null, to: string | null) => {
  if (!from) return "active";
  const today = new Date();
  const start = new Date(`${from}T00:00:00Z`);
  if (start > today) return "upcoming";
  if (to) {
    const end = new Date(`${to}T23:59:59Z`);
    if (end < today) return "expired";
  }
  return "active";
};

const shouldDetectAcrossMarketplaces = async (
  supabase: ReturnType<typeof createClient>,
  override?: boolean
) => {
  if (typeof override === "boolean") return override;
  try {
    const { data, error } = await supabase
      .from("reconciliation_preferences")
      .select("detect_cross_marketplace")
      .limit(1)
      .maybeSingle<{ detect_cross_marketplace?: boolean }>();
    if (error) {
      if (error.code === "42P01") return false;
      console.warn("publish_rate_card_data preferences error", error);
      return false;
    }
    return Boolean(data?.detect_cross_marketplace);
  } catch (err) {
    console.warn("publish_rate_card_data preference fetch failed", err);
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return respond(200, { status: "ready" });
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
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: uploadRecord, error: fetchError } = await supabase
      .from("rate_card_data")
      .select("id, rate_card_template_type, rate_card_version, uploaded_by, data, validation_status, status, issues")
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

    const action = payload.action ?? "detect";

    const detectAcrossMarketplace = await shouldDetectAcrossMarketplaces(
      supabase,
      payload.cross_marketplace
    );

    const categories = Array.from(new Set(normalizedRows.map((row) => row.category_id)));
    const platforms = Array.from(normalizedRows.map((row) => row.platform_id));

    let existingQuery = supabase
      .from("rate_cards_v2")
      .select("*")
      .eq("archived", false)
      .in("category_id", categories);

    if (!detectAcrossMarketplace) {
      existingQuery = existingQuery.in("platform_id", platforms);
    }

    const { data: existingCards, error: existingError } = await existingQuery;
    if (existingError) {
      console.error("publish_rate_card_data existing fetch error", existingError);
      return respond(400, { status: "error", message: existingError.message, code: existingError.code });
    }

    const conflicts: ConflictItem[] = [];
    let restorePreviousCards: any[] = [];
    let restorePreviousFees: any[] = [];
    let restorePreviousSlabs: any[] = [];
    normalizedRows.forEach((row) => {
      if (!row) return;
      const newFromDate = new Date(`${row.effective_from}T00:00:00Z`);
      const newToDate = row.effective_to ? new Date(`${row.effective_to}T23:59:59Z`) : null;

      existingCards?.forEach((existing) => {
        const existingStatus = computeStatus(existing.effective_from ?? null, existing.effective_to ?? null);
        if (existingStatus !== "active" && existingStatus !== "upcoming") return;
        const templateMatches =
          !existing.template_type || existing.template_type === uploadRecord.rate_card_template_type;
        if (!templateMatches) return;
        if (existing.category_id !== row.category_id) return;
        if (!detectAcrossMarketplace && existing.platform_id !== row.platform_id) return;

        const existingFrom = existing.effective_from ?? null;
        const existingTo = existing.effective_to ?? null;
        const existingFromDate = existingFrom ? new Date(`${existingFrom}T00:00:00Z`) : null;
        const existingToDate = existingTo ? new Date(`${existingTo}T23:59:59Z`) : null;

        console.info("[publish-conflict-check]", {
          new: {
            platform: row.platform_id,
            category: row.category_id,
            from: row.effective_from,
            to: row.effective_to,
          },
          existing: {
            id: existing.id,
            platform: existing.platform_id,
            category: existing.category_id,
            from: existingFrom,
            to: existingTo,
            status: existingStatus,
          },
        });

        const overlaps =
          (!newToDate || !existingFromDate || existingFromDate <= newToDate) &&
          (!existingToDate || existingToDate >= newFromDate);
        if (!overlaps) return;

        conflicts.push({
          existing_id: existing.id,
          existing_platform: existing.platform_id,
          existing_category: existing.category_id,
          existing_range: formatRange(existingFrom, existingTo),
          existing_rate: {
            commission_type: existing.commission_type,
            commission_percent: existing.commission_percent ? Number(existing.commission_percent) : null,
          },
          existing_status: existingStatus,
          existing_version: existing.template_version ?? null,
          new_platform: row.display_marketplace,
          new_category: row.display_category,
          new_range: formatRange(row.effective_from, row.effective_to),
          new_rate: {
            commission_type: row.commission_type,
            commission_percent: row.commission_percent,
          },
          version_mismatch:
            Boolean(existing.template_version) && existing.template_version !== uploadRecord.rate_card_version,
        });
      });
    });

    if (conflicts.length && action !== "replace_existing") {
      const first = conflicts[0];
      return respond(200, {
        status: "conflict",
        message: `Overlapping rate cards found for ${first.new_platform} – ${first.new_category}.`,
        conflicts,
        template_type: uploadRecord.rate_card_template_type,
        template_version: uploadRecord.rate_card_version ?? "v3.2",
        cross_marketplace_enabled: detectAcrossMarketplace,
        published_count: 0,
      });
    }

    if (action === "trim_existing") {
      return respond(400, {
        status: "error",
        message: "trim_existing action is not supported yet",
        published_count: 0,
      });
    }

    if (action === "replace_existing" && conflicts.length) {
      const idsToDelete = Array.from(new Set(conflicts.map((conflict) => conflict.existing_id)));
      if (idsToDelete.length) {
        restorePreviousCards = (existingCards ?? []).filter((card) => idsToDelete.includes(card.id));

        if (restorePreviousCards.length) {
          const idList = restorePreviousCards.map((card) => card.id);

          const { data: previousSlabs, error: slabError } = await supabase
            .from("rate_card_slabs")
            .select("*")
            .in("rate_card_id", idList);
          if (slabError) {
            console.error("publish_rate_card_data fetch previous slabs error", slabError);
            return respond(400, {
              status: "error",
              message: slabError.message,
              code: slabError.code,
              published_count: 0,
            });
          }
          restorePreviousSlabs = previousSlabs ?? [];

          const { data: previousFees, error: feeError } = await supabase
            .from("rate_card_fees")
            .select("*")
            .in("rate_card_id", idList);
          if (feeError) {
            console.error("publish_rate_card_data fetch previous fees error", feeError);
            return respond(400, {
              status: "error",
              message: feeError.message,
              code: feeError.code,
              published_count: 0,
            });
          }
          restorePreviousFees = previousFees ?? [];
        }

        const { error: deleteError } = await supabase
          .from("rate_cards_v2")
          .delete()
          .in("id", idsToDelete);
        if (deleteError) {
          console.error("publish_rate_card_data delete conflict error", deleteError);
          return respond(400, {
            status: "error",
            message: deleteError.message,
            code: deleteError.code,
            published_count: 0,
          });
        }
      }
    }

    if (action === "detect" && !conflicts.length) {
      return respond(200, {
        status: "success",
        message: "No conflicts detected. Confirm to publish.",
        published_count: 0,
        template_type: uploadRecord.rate_card_template_type,
        template_version: uploadRecord.rate_card_version ?? "v3.2",
        ready_to_publish: true,
        row_count: normalizedRows.length,
      });
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

    const { data: insertedRows, error: insertError } = await supabase
      .from("rate_cards_v2")
      .insert(rowsToInsert)
      .select("id");

    if (insertError) {
      console.error("publish_rate_card_data insert error", insertError);
      return respond(400, {
        status: "error",
        message: insertError.message,
        code: insertError.code,
        published_count: 0,
      });
    }

    const insertedIds = (insertedRows ?? [])
      .map((row) => (row && typeof row.id === "string" ? row.id : null))
      .filter((value): value is string => Boolean(value));

    const restoreIssues: Record<string, unknown> = (() => {
      const raw = uploadRecord.issues;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return jsonSafeClone(raw as Record<string, unknown>);
      }
      if (Array.isArray(raw)) {
        return { legacy: jsonSafeClone(raw) };
      }
      return {};
    })();

    if (insertedIds.length || restorePreviousCards.length || restorePreviousFees.length || restorePreviousSlabs.length) {
      restoreIssues.restore = jsonSafeClone({
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        new_card_ids: insertedIds,
        previous_cards: restorePreviousCards.length ? restorePreviousCards : [],
        previous_fees: restorePreviousFees.length ? restorePreviousFees : [],
        previous_slabs: restorePreviousSlabs.length ? restorePreviousSlabs : [],
        used_at: null,
      });
    }

    const updatePayload: Record<string, unknown> = {
      status: "published",
      record_count: normalizedRows.length,
    };

    if (restoreIssues.restore) {
      updatePayload.issues = restoreIssues;
    }

    const { error: updateError } = await supabase
      .from("rate_card_data")
      .update(updatePayload)
      .eq("id", uploadRecord.id);

    if (updateError) {
      console.error("publish_rate_card_data status update error", updateError);
      return respond(400, {
        status: "error",
        message: updateError.message,
        code: updateError.code,
        published_count: 0,
      });
    }

    return respond(200, {
      status: "success",
      message: `Published ${insertedRows?.length ?? normalizedRows.length} rate card rows`,
      published_count: insertedRows?.length ?? normalizedRows.length,
      upload_id: uploadRecord.id,
      template_type: uploadRecord.rate_card_template_type,
      template_version: uploadRecord.rate_card_version ?? "v3.2",
    });
  } catch (error) {
    console.error("publish_rate_card_data unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respond(500, { status: "error", message, published_count: 0 });
  }
});
