import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { parse as parseCsv } from "https://deno.land/std@0.177.0/encoding/csv.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type RowStatus = "valid" | "similar" | "duplicate" | "error";

interface RateCardPayload {
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
  slabs?: Array<{ min_price: number; max_price: number | null; commission_percent: number }>;
  fees?: Array<{ fee_code: string; fee_type: "percent" | "amount"; fee_value: number }>;
  effective_from: string;
  effective_to: string | null;
  gst_percent?: string | number | null;
  tcs_percent?: string | number | null;
  settlement_basis?: string | null;
  t_plus_days?: number | null;
  weekly_weekday?: number | null;
  bi_weekly_weekday?: number | null;
  bi_weekly_which?: string | null;
  monthly_day?: string | null;
  grace_days?: number | null;
  global_min_price?: number | null;
  global_max_price?: number | null;
  notes?: string | null;
}

interface NormalizedFee {
  fee_code: string;
  fee_type: "percent" | "amount";
  fee_value: number;
}

interface NormalizedSlab {
  min_price: number;
  max_price: number | null;
  commission_percent: number;
}

interface NormalizedCard {
  id: string | null;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
  slabs: NormalizedSlab[];
  fees: NormalizedFee[];
  effective_from: string;
  effective_to: string | null;
  archived: boolean;
}

function canonId(v: any) {
  return (v ?? "").toString().trim().toLowerCase();
}

type OverlapType = "none" | "similar" | "duplicate";

interface OverlapResult {
  type: OverlapType;
  existing?: NormalizedCard;
  archivedMatch?: {
    card: NormalizedCard;
    type: "duplicate" | "similar";
  };
}

interface RowOut {
  row: number;
  status: RowStatus;
  message: string;
  tooltip?: string;
  existing?: {
    id: string;
    label: string;
    date_range: string;
  };
  archivedMatch?: {
    id: string;
    label: string;
    date_range: string;
    type: "exact" | "overlap";
  };
  suggestions?: Array<
    | { type: "shift_from"; new_from: string; reason: string }
    | { type: "clip_to"; new_to: string; reason: string }
    | { type: "skip"; reason: string }
  >;
  payload?: RateCardPayload;
}

const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  quick: "Quick Commerce",
};

const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home",
};

const displayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials are missing. The rate-cards function will fail for DB reads.");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function validatePayload(payload: RateCardPayload): string[] {
  const issues: string[] = [];
  if (!payload.platform_id?.toString().trim()) issues.push("platform_id is required");
  if (!payload.category_id?.toString().trim()) issues.push("category_id is required");
  if (!payload.commission_type) issues.push("commission_type is required");
  if (!payload.effective_from?.toString().trim()) issues.push("effective_from is required");
  if (!payload.settlement_basis?.toString().trim()) issues.push("settlement_basis is required");
  if (
    payload.commission_type !== "flat" &&
    payload.commission_type !== "tiered"
  ) {
    issues.push("commission_type must be 'flat' or 'tiered'");
  }
  if (payload.commission_type === "tiered" && (!payload.slabs || payload.slabs.length === 0)) {
    issues.push("Tiered commission requires at least one slab.");
  }
  return issues;
}

function uiLabel(platformId?: string | null, categoryId?: string | null) {
  const platform = platformId ? PLATFORM_LABELS[platformId] ?? capitalize(platformId) : "Unknown";
  const category = categoryId ? CATEGORY_LABELS[categoryId] ?? capitalize(categoryId) : "Unknown";
  return `${platform} • ${category}`;
}

function uiRange(from: string, to: string | null) {
  const start = displayFormatter.format(new Date(`${from}T00:00:00Z`));
  const end = to ? displayFormatter.format(new Date(`${to}T00:00:00Z`)) : "open";
  return `${start} → ${end}`;
}

function commissionDesc(card: NormalizedCard | RateCardPayload) {
  if (card.commission_type === "tiered") {
    const count = Array.isArray(card.slabs) ? card.slabs.length : (card as any).slabs?.length ?? 0;
    return `Tiered (${count} slab${count === 1 ? "" : "s"})`;
  }
  const percent = Number((card as any).commission_percent ?? 0);
  return `Flat (${percent}%)`;
}

function capitalize(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function parseJsonArrayField(raw: unknown, field: string, issues: string[]): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const text = String(raw).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    issues.push(`${field} must be an array`);
  } catch (_err) {
    issues.push(`${field} must be valid JSON array`);
  }
  return [];
}

function prepareFees(fees: any[]): NormalizedFee[] {
  const normalized: NormalizedFee[] = [];
  for (const fee of fees || []) {
    if (!fee) continue;
    const fee_code = String(fee.fee_code ?? "").trim();
    if (!fee_code) continue;
    const fee_type = String(fee.fee_type ?? "percent").trim() === "amount" ? "amount" : "percent";
    const fee_value = Number(fee.fee_value ?? 0);
    if (Number.isNaN(fee_value)) continue;
    normalized.push({ fee_code, fee_type, fee_value });
  }
  return normalized.sort((a, b) => a.fee_code.localeCompare(b.fee_code) || a.fee_type.localeCompare(b.fee_type));
}

function prepareSlabs(slabs: any[]): NormalizedSlab[] {
  const normalized: NormalizedSlab[] = [];
  for (const slab of slabs || []) {
    if (!slab) continue;
    const min_price = Number(slab.min_price ?? slab.minPrice ?? 0);
    const rawMax = slab.max_price ?? slab.maxPrice ?? slab.max_price_value;
    const max_price = rawMax === null || rawMax === undefined || rawMax === "" ? null : Number(rawMax);
    const commission_percent = Number(slab.commission_percent ?? slab.commissionPercent ?? 0);
    if (Number.isNaN(min_price) || Number.isNaN(commission_percent)) continue;
    if (max_price !== null && Number.isNaN(max_price)) continue;
    normalized.push({
      min_price,
      max_price: max_price === null ? null : Number(max_price),
      commission_percent,
    });
  }
  return normalized.sort((a, b) => a.min_price - b.min_price);
}

function feesEqual(a: NormalizedFee[], b: NormalizedFee[]) {
  if (a.length !== b.length) return false;
  return a.every((fee, idx) => {
    const other = b[idx];
    return fee.fee_code === other.fee_code && fee.fee_type === other.fee_type && Math.abs(fee.fee_value - other.fee_value) < 1e-6;
  });
}

function slabsEqual(a: NormalizedSlab[], b: NormalizedSlab[]) {
  if (a.length !== b.length) return false;
  return a.every((slab, idx) => {
    const other = b[idx];
    return (
      Math.abs(slab.min_price - other.min_price) < 1e-6 &&
      (slab.max_price === other.max_price ||
        (slab.max_price === null && other.max_price === null) ||
        (slab.max_price !== null &&
          other.max_price !== null &&
          Math.abs(slab.max_price - other.max_price) < 1e-6)) &&
      Math.abs(slab.commission_percent - other.commission_percent) < 1e-6
    );
  });
}

function normalizeCard(payload: RateCardPayload, tempId?: string): NormalizedCard {
  return {
    id: tempId ?? null,
    platform_id: canonId(payload.platform_id),
    category_id: canonId(payload.category_id),
    commission_type: payload.commission_type,
    commission_percent: payload.commission_type === "flat" ? Number(payload.commission_percent ?? 0) : null,
    slabs: payload.commission_type === "tiered" ? prepareSlabs(payload.slabs ?? []) : [],
    fees: prepareFees(payload.fees ?? []),
    effective_from: payload.effective_from,
    effective_to: payload.effective_to ?? null,
    archived: false,
  };
}

function detectOverlap(
  card: NormalizedCard,
  others: NormalizedCard[],
  options?: { includeArchivedForBlocking?: boolean }
): OverlapResult {
  const includeArchived = options?.includeArchivedForBlocking ?? false;
  const from = new Date(`${card.effective_from}T00:00:00Z`).getTime();
  const to = card.effective_to ? new Date(`${card.effective_to}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;

  for (const other of others) {
    if (card.id && other.id && card.id === other.id) continue;
    if (canonId(card.platform_id) !== canonId(other.platform_id)) continue;
    if (canonId(card.category_id) !== canonId(other.category_id)) continue;

    if (Deno.env.get("NODE_ENV") !== "production") {
      (globalThis as any).__rc_dbg = ((globalThis as any).__rc_dbg ?? 0) + 1;
      if ((globalThis as any).__rc_dbg <= 5) {
        console.debug("[overlap-check]", {
          new: {
            p: card.platform_id,
            c: card.category_id,
            from: card.effective_from,
            to: card.effective_to,
          },
          existing: {
            p: other.platform_id,
            c: other.category_id,
            from: other.effective_from,
            to: other.effective_to,
          },
        });
      }
    }

    const otherFrom = new Date(`${other.effective_from}T00:00:00Z`).getTime();
    const otherTo = other.effective_to ? new Date(`${other.effective_to}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;

    const overlaps = otherFrom <= to && from <= otherTo;
    if (!overlaps) continue;

    const sameRange =
      card.effective_from === other.effective_from &&
      ((card.effective_to === null && other.effective_to === null) || card.effective_to === other.effective_to);

    const sameCommission =
      card.commission_type === other.commission_type &&
      (card.commission_type === "flat"
        ? Math.abs((card.commission_percent ?? 0) - (other.commission_percent ?? 0)) < 1e-6
        : slabsEqual(card.slabs, other.slabs));

    const sameFees = feesEqual(card.fees, other.fees);

    const matchType: "duplicate" | "similar" = sameRange && sameCommission && sameFees ? "duplicate" : "similar";

    if (other.archived && !includeArchived) {
      return { type: "none", archivedMatch: { card: other, type: matchType } };
    }

    if (matchType === "duplicate") {
      return { type: "duplicate", existing: other };
    }

    return { type: "similar", existing: other };
  }

  return { type: "none" };
}

async function loadExistingRateCards(): Promise<NormalizedCard[]> {
  if (!supabase) return [];
  const cardsRes = await supabase
    .from("rate_cards_v2")
    .select(
      "id, platform_id, category_id, commission_type, commission_percent, effective_from, effective_to, archived"
    );
  if (cardsRes.error || !cardsRes.data) {
    console.error("Failed to fetch rate cards", cardsRes.error);
    return [];
  }

  const ids = cardsRes.data.map((row) => row.id);
  const [feesRes, slabsRes] = await Promise.all([
    supabase
      .from("rate_card_fees")
      .select("rate_card_id, fee_code, fee_type, fee_value")
      .in("rate_card_id", ids),
    supabase
      .from("rate_card_slabs")
      .select("rate_card_id, min_price, max_price, commission_percent")
      .in("rate_card_id", ids),
  ]);

  const feeMap = new Map<string, NormalizedFee[]>();
  if (!feesRes.error && feesRes.data) {
    for (const fee of feesRes.data) {
      const list = feeMap.get(fee.rate_card_id) ?? [];
      list.push({
        fee_code: String(fee.fee_code ?? ""),
        fee_type: fee.fee_type === "amount" ? "amount" : "percent",
        fee_value: Number(fee.fee_value ?? 0),
      });
      feeMap.set(fee.rate_card_id, list);
    }
  }

  const slabMap = new Map<string, NormalizedSlab[]>();
  if (!slabsRes.error && slabsRes.data) {
    for (const slab of slabsRes.data) {
      const list = slabMap.get(slab.rate_card_id) ?? [];
      list.push({
        min_price: Number(slab.min_price ?? 0),
        max_price:
          slab.max_price === null || slab.max_price === undefined ? null : Number(slab.max_price ?? null),
        commission_percent: Number(slab.commission_percent ?? 0),
      });
      slabMap.set(slab.rate_card_id, list);
    }
  }

  return cardsRes.data.map((row) => ({
    id: row.id,
    platform_id: canonId(row.platform_id),
    category_id: canonId(row.category_id),
    commission_type: (row.commission_type as "flat" | "tiered") ?? "flat",
    commission_percent: row.commission_percent === null ? null : Number(row.commission_percent),
    slabs: prepareSlabs(slabMap.get(row.id) ?? []),
    fees: prepareFees(feeMap.get(row.id) ?? []),
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    archived: Boolean((row as any).archived ?? false),
  }));
}

function sentenceCaseErrors(errors: string[]) {
  return errors
    .map((raw) => {
      const cleaned = raw.replace(/^[\s-]+/, "");
      if (!cleaned) return cleaned;
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join("; ")
    .replace(/\.;/g, ";");
}

function parseStrictCsv(csv: string): Record<string, string>[] {
  const parsed = parseCsv(csv, { header: true, skipFirstRow: false });
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed as Record<string, string>[];
}

function parseLenientCsv(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    rows.push(record);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function buildPayload(row: Record<string, any>, issues: string[]): RateCardPayload {
  const slabs = parseJsonArrayField(row.slabs_json ?? row.slabs, "slabs", issues);
  const fees = parseJsonArrayField(row.fees_json ?? row.fees, "fees", issues);

  const platformId = String(row.platform_id ?? "").trim();
  const categoryId = String(row.category_id ?? "").trim();
  const commissionType = String(row.commission_type ?? "flat").trim().toLowerCase();
  const settlementBasis = String(row.settlement_basis ?? "").trim().toLowerCase();
  const effectiveFrom = String(row.effective_from ?? "").trim();
  const effectiveTo = String(row.effective_to ?? "").trim();

  const payload: RateCardPayload = {
    platform_id: platformId,
    category_id: categoryId,
    commission_type: commissionType === "tiered" ? "tiered" : "flat",
    commission_percent: toNumber(row.commission_percent),
    slabs,
    fees,
    effective_from: effectiveFrom,
    effective_to: effectiveTo || null,
    gst_percent: row.gst_percent ?? null,
    tcs_percent: row.tcs_percent ?? null,
    settlement_basis: settlementBasis || null,
    t_plus_days: toNumber(row.t_plus_days),
    weekly_weekday: toNumber(row.weekly_weekday),
    bi_weekly_weekday: toNumber(row.bi_weekly_weekday),
    bi_weekly_which: row.bi_weekly_which ?? null,
    monthly_day: row.monthly_day ?? null,
    grace_days: toNumber(row.grace_days),
    global_min_price: toNumber(row.global_min_price),
    global_max_price: toNumber(row.global_max_price),
    notes: row.notes ?? null,
  };

  if (!payload.platform_id) issues.push("platform_id is required");
  if (!payload.category_id) issues.push("category_id is required");
  if (!payload.commission_type) issues.push("commission_type is required");
  if (!payload.effective_from) issues.push("effective_from is required");
  if (!payload.settlement_basis) issues.push("settlement_basis is required");
  if (
    payload.commission_type &&
    payload.commission_type !== "flat" &&
    payload.commission_type !== "tiered"
  ) {
    issues.push("commission_type must be 'flat' or 'tiered'");
  }

  if (payload.commission_type === "tiered" && (!Array.isArray(payload.slabs) || payload.slabs.length === 0)) {
    issues.push("Tiered commission requires at least one slab.");
  }

  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type,authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  if (url.pathname.endsWith("/parse-row")) {
    try {
      const payload = (await req.json()) as RateCardPayload;
      if (!payload || typeof payload !== "object") {
        return jsonResponse({ message: "Missing payload" }, 400);
      }

      const issues = validatePayload(payload);
      const errors = sentenceCaseErrors(issues);
      const normalized = normalizeCard(payload, `parse-row-${Date.now()}`);
      const existingCards = await loadExistingRateCards();
      const overlap = detectOverlap(normalized, existingCards);

      let status: RowStatus = "valid";
      let message = "Ready to import.";
      let tooltip: string | undefined;
      let archivedMatchMeta:
        | {
            id: string;
            label: string;
            date_range: string;
            type: "exact" | "overlap";
          }
        | undefined;

      let overlapReason: string | undefined;

      if (errors.length) {
        status = "error";
        message = errors.join("; ");
      } else if (overlap.archivedMatch) {
        const archivedCard = overlap.archivedMatch.card;
        const archivedType = overlap.archivedMatch.type === "duplicate" ? "exact" : "overlap";
        archivedMatchMeta = {
          id: archivedCard.id ?? "",
          label: uiLabel(archivedCard.platform_id, archivedCard.category_id),
          date_range: uiRange(archivedCard.effective_from, archivedCard.effective_to),
          type: archivedType,
        };
        tooltip = `Archived match (${archivedMatchMeta.type}): ${archivedMatchMeta.label} (${archivedMatchMeta.date_range}). Archived cards don't affect reconciliation.`;
      } else if (overlap.type !== "none") {
        const existing = overlap.existing;
        const existingMeta = existing
          ? {
              label: uiLabel(existing.platform_id, existing.category_id),
              date_range: uiRange(existing.effective_from, existing.effective_to),
            }
          : undefined;

        if (overlap.type === "duplicate") {
          status = "duplicate";
          message = `Exact duplicate of ${existingMeta?.label ?? "existing card"} (${existingMeta?.date_range ?? "same range"}). Remove or edit this row.`;
          tooltip = "Same date range, commission and fees.";
          overlapReason = message;
        } else {
          status = "similar";
          message = `Overlaps existing ${existingMeta?.label ?? "rate card"} (${existingMeta?.date_range ?? "date range"}). Adjust dates or confirm import.`;
          if (existing) {
            tooltip = `Date overlap with an existing card.\nYour row: ${commissionDesc(normalized)} (${uiRange(normalized.effective_from, normalized.effective_to)}).\nExisting: ${commissionDesc(existing)} (${uiRange(existing.effective_from, existing.effective_to)}).`;
          }
          overlapReason = message;
        }
      }

      return jsonResponse({
        status,
        message,
        ...(tooltip ? { tooltip } : {}),
        ...(archivedMatchMeta ? { archivedMatch: archivedMatchMeta } : {}),
        normalized,
        errors,
        ...(overlap.type !== "none"
          ? {
              overlap: {
                type: overlap.type === "duplicate" ? "exact" : "similar",
                reason: overlapReason ?? message,
              },
            }
          : {}),
      });
    } catch (error: any) {
      console.error("parse-row error", error);
      return jsonResponse({ message: error?.message || "Failed to analyze row" }, 500);
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonResponse({ message: "No file uploaded" }, 400);
    }

    const text = await file.text();
    let rows: Record<string, string>[] = [];
    try {
      rows = parseStrictCsv(text);
    } catch (err) {
      console.warn("Strict CSV parse failed, attempting lenient parser", err);
      rows = parseLenientCsv(text);
    }

    if (!rows.length) {
      return jsonResponse({ message: "CSV is empty or malformed" }, 400);
    }

    const existingCards = await loadExistingRateCards();
    const referenceCards: NormalizedCard[] = [...existingCards];

    const results: RowOut[] = [];
    let valid = 0;
    let similar = 0;
    let duplicate = 0;
    let error = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const issues: string[] = [];
      const payload = buildPayload(raw, issues);

      if (issues.length) {
        error += 1;
        results.push({
          row: i + 2,
          status: "error",
          message: sentenceCaseErrors(issues),
          payload,
        });
        continue;
      }

      const normalized = normalizeCard(payload, `pending-${i}`);
      const overlap = detectOverlap(normalized, referenceCards);

      if (overlap.archivedMatch) {
        const archivedCard = overlap.archivedMatch.card;
        const archivedType = overlap.archivedMatch.type === "duplicate" ? "exact" : "overlap";
        const archivedMeta = {
          id: archivedCard.id ?? "",
          label: uiLabel(archivedCard.platform_id, archivedCard.category_id),
          date_range: uiRange(archivedCard.effective_from, archivedCard.effective_to),
          type: archivedType as "exact" | "overlap",
        };

        valid += 1;
        results.push({
          row: i + 2,
          status: "valid",
          message: "Ready to import.",
          tooltip: `Archived match (${archivedMeta.type}): ${archivedMeta.label} (${archivedMeta.date_range}). Archived cards don't affect reconciliation.`,
          archivedMatch: archivedMeta,
          payload,
        });
        referenceCards.push(normalized);
        continue;
      }

      if (overlap.type === "none") {
        valid += 1;
        results.push({
          row: i + 2,
          status: "valid",
          message: "Ready to import.",
          payload,
        });
        referenceCards.push(normalized);
        continue;
      }

      const existing = overlap.existing;
      const existingMeta = existing
        ? {
            id: existing.id ?? "",
            label: uiLabel(existing.platform_id, existing.category_id),
            date_range: uiRange(existing.effective_from, existing.effective_to),
          }
        : undefined;

      if (overlap.type === "duplicate") {
        duplicate += 1;
        results.push({
          row: i + 2,
          status: "duplicate",
          message: `Exact duplicate of ${existingMeta?.label ?? "existing rate card"} (${existingMeta?.date_range ?? "same range"}). Remove or edit this row.`,
          tooltip: "Same date range, commission and fees.",
          existing: existingMeta,
          payload,
        });
        continue;
      }

      // similar
      similar += 1;
      const suggestions: RowOut["suggestions"] = [];
      if (existing && existing.effective_to) {
        const newStartDate = new Date(`${payload.effective_from}T00:00:00Z`).getTime();
        const existingEndDate = new Date(`${existing.effective_to}T00:00:00Z`).getTime();
        if (!Number.isNaN(existingEndDate) && newStartDate <= existingEndDate) {
          const shiftDate = new Date(existingEndDate);
          shiftDate.setUTCDate(shiftDate.getUTCDate() + 1);
          const newFrom = shiftDate.toISOString().slice(0, 10);
          suggestions.push({
            type: "shift_from",
            new_from: newFrom,
            reason: "Start the new card after the existing one ends to avoid overlap.",
          });
        } else {
          suggestions.push({ type: "skip", reason: "Skip this row or adjust dates to resolve overlap." });
        }
      } else {
        suggestions.push({ type: "skip", reason: "Skip this row or adjust dates to resolve overlap." });
      }

      const tooltip = existing
        ? `Date overlap with different commission/fees. Your row: ${commissionDesc(normalized)}. Existing: ${commissionDesc(existing)}.`
        : "Date overlap with existing rate card.";

      results.push({
        row: i + 2,
        status: "similar",
        message: `Overlaps existing ${existingMeta?.label ?? "rate card"} (${existingMeta?.date_range ?? "date range"}). Adjust dates or confirm import.`,
        tooltip,
        existing: existingMeta,
        suggestions,
        payload,
      });

      referenceCards.push(normalized);
    }

    const summary = {
      total: results.length,
      valid,
      similar,
      duplicate,
      error,
    };

    return jsonResponse({ summary, rows: results });
  } catch (error) {
    console.error("rate-cards function error", error);
    return jsonResponse({ message: "Failed to process CSV", error: String(error?.message ?? error) }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
