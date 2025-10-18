import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

type RateCardPayloadBase = {
  id?: string;
  platform_id: string;
  category_id: string;
  commission_type: "flat" | "tiered";
  commission_percent?: number | string | null;
  slabs?: Array<{ min_price: number | string | null; max_price: number | string | null; commission_percent: number | string | null }>;
  fees?: Array<{ fee_code: string; fee_type: "percent" | "amount"; fee_value: number | string | null }>;
  effective_from: string;
  effective_to?: string | null;
  gst_percent?: number | string | null;
  tcs_percent?: number | string | null;
  settlement_basis?: string | null;
  t_plus_days?: number | string | null;
  weekly_weekday?: number | string | null;
  bi_weekly_weekday?: number | string | null;
  bi_weekly_which?: string | null;
  monthly_day?: string | null;
  grace_days?: number | string | null;
  global_min_price?: number | string | null;
  global_max_price?: number | string | null;
  notes?: string | null;
};

export type RateCardPayload = RateCardPayloadBase;

export type NormalizedFee = { fee_code: string; fee_type: "percent" | "amount"; fee_value: number };
export type NormalizedSlab = { min_price: number; max_price: number | null; commission_percent: number };
export type NormalizedCard = {
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
};

type OverlapResult = { type: "exact" | "similar"; existing: NormalizedCard; reason: string };

export type RateCardAnalysis = {
  errors: string[];
  overlap: OverlapResult | null;
  archivedMatch?: { existing: NormalizedCard; type: "exact" | "similar"; reason: string };
  normalized: NormalizedCard;
};

export const PLATFORM_LABELS: Record<string, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
  ajio: "AJIO",
  quick: "Quick Commerce",
};

export const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Apparel",
  electronics: "Electronics",
  beauty: "Beauty",
  home: "Home",
};

const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDisplayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return displayDateFormatter.format(date);
}

export function formatDateRange(from?: string | null, to?: string | null) {
  const start = formatDisplayDate(from) ?? from ?? "-";
  const end = to ? formatDisplayDate(to) ?? to : "open";
  return `${start} → ${end}`;
}

export function formatLabel(platformId?: string | null, categoryId?: string | null) {
  const platform = platformId ? PLATFORM_LABELS[platformId] ?? platformId : "Unknown";
  const category = categoryId ? CATEGORY_LABELS[categoryId] ?? categoryId : "Unknown";
  return `${platform} • ${category}`;
}

export function humanizeErrorMessage(raw: string) {
  const normalized = raw.replace(/_/g, " ").trim();
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function canonId(value: any) {
  return (value ?? "").toString().trim().toLowerCase();
}

function cleanNumber(value: any): number {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  const cleaned = String(value).replace(/[%₹$€£,\s]/g, "");
  if (!cleaned.length) return Number.NaN;
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return Number.NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : Number.NaN;
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = cleanNumber(value);
  return Number.isNaN(num) ? null : num;
}

function prepareFees(fees: RateCardPayload["fees"]): NormalizedFee[] {
  const normalized: NormalizedFee[] = [];
  for (const fee of fees || []) {
    if (!fee) continue;
    const fee_code = String(fee.fee_code ?? "").trim();
    if (!fee_code) continue;
    const rawType = String(fee.fee_type ?? "percent").trim();
    const fee_type: "percent" | "amount" = rawType === "amount" ? "amount" : "percent";
    const fee_value = Number(fee.fee_value ?? 0);
    if (Number.isNaN(fee_value)) continue;
    normalized.push({ fee_code, fee_type, fee_value });
  }
  return normalized.sort((a, b) => a.fee_code.localeCompare(b.fee_code) || a.fee_type.localeCompare(b.fee_type));
}

function prepareSlabs(slabs: RateCardPayload["slabs"]): NormalizedSlab[] {
  const normalized: NormalizedSlab[] = [];
  for (const slab of slabs || []) {
    if (!slab) continue;
    const min_price = Number(slab.min_price ?? 0);
    const maxValue = slab.max_price;
    const max_price =
      maxValue === null || maxValue === undefined || maxValue === "" ? null : Number(maxValue);
    const commission_percent = Number(slab.commission_percent ?? 0);
    if (Number.isNaN(min_price) || Number.isNaN(commission_percent)) continue;
    if (max_price !== null && Number.isNaN(max_price)) continue;
    normalized.push({ min_price, max_price, commission_percent });
  }
  return normalized.sort((a, b) => a.min_price - b.min_price);
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

function feesEqual(a: NormalizedFee[], b: NormalizedFee[]) {
  if (a.length !== b.length) return false;
  return a.every((fee, idx) => {
    const other = b[idx];
    return (
      fee.fee_code === other.fee_code &&
      fee.fee_type === other.fee_type &&
      Math.abs(fee.fee_value - other.fee_value) < 1e-6
    );
  });
}

function dateOnly(input: string) {
  return new Date(new Date(input).toISOString().slice(0, 10));
}

function buildOverlapReason(card: NormalizedCard, existing: NormalizedCard, type: "exact" | "similar") {
  const range = `${existing.effective_from} → ${existing.effective_to ?? "open"}`;
  const label = type === "exact" ? "exact duplicate" : "overlap";
  return `${label} with ${existing.platform_id}/${existing.category_id} (${range}) [id=${existing.id ?? "existing"}]`;
}

export async function loadExistingRateCards(client: SupabaseClient): Promise<NormalizedCard[]> {
  const { data: base, error: baseError } = await client
    .from("rate_cards_v2")
    .select(
      [
        "id",
        "platform_id",
        "category_id",
        "commission_type",
        "commission_percent",
        "effective_from",
        "effective_to",
        "archived",
      ].join(",")
    );
  if (baseError) throw new Error(baseError.message);

  const { data: feeRows, error: feeError } = await client
    .from("rate_card_fees")
    .select(["rate_card_id", "fee_code", "fee_type", "fee_value"].join(","));
  if (feeError) throw new Error(feeError.message);

  const { data: slabRows, error: slabError } = await client
    .from("rate_card_slabs")
    .select(["rate_card_id", "min_price", "max_price", "commission_percent"].join(","));
  if (slabError) throw new Error(slabError.message);

  const feeMap = new Map<string, NormalizedFee[]>();
  for (const row of feeRows ?? []) {
    const list = feeMap.get(row.rate_card_id) ?? [];
    list.push({
      fee_code: String(row.fee_code ?? ""),
      fee_type: row.fee_type === "amount" ? "amount" : "percent",
      fee_value: Number(row.fee_value ?? 0),
    });
    feeMap.set(row.rate_card_id, list);
  }

  const slabMap = new Map<string, NormalizedSlab[]>();
  for (const row of slabRows ?? []) {
    const list = slabMap.get(row.rate_card_id) ?? [];
    list.push({
      min_price: Number(row.min_price ?? 0),
      max_price:
        row.max_price === null || row.max_price === undefined ? null : Number(row.max_price),
      commission_percent: Number(row.commission_percent ?? 0),
    });
    slabMap.set(row.rate_card_id, list);
  }

  return (base ?? []).map((card) => ({
    id: card.id,
    platform_id: canonId(card.platform_id),
    category_id: canonId(card.category_id),
    commission_type: (card.commission_type as "flat" | "tiered") ?? "flat",
    commission_percent:
      card.commission_percent === null || card.commission_percent === undefined
        ? null
        : Number(card.commission_percent),
    slabs: slabMap.get(card.id) ?? [],
    fees: (feeMap.get(card.id) ?? []).sort((a, b) => a.fee_code.localeCompare(b.fee_code)),
    effective_from: card.effective_from,
    effective_to: card.effective_to ?? null,
    archived: Boolean(card.archived),
  }));
}

function detectOverlap(card: NormalizedCard, others: NormalizedCard[]): OverlapResult | null {
  const from = dateOnly(card.effective_from);
  const to = card.effective_to ? dateOnly(card.effective_to) : null;

  for (const other of others) {
    if (!other) continue;
    if (card.id && other.id && card.id === other.id) continue;
    if (canonId(card.platform_id) !== canonId(other.platform_id)) continue;
    if (canonId(card.category_id) !== canonId(other.category_id)) continue;

    const otherFrom = dateOnly(other.effective_from);
    const otherTo = other.effective_to ? dateOnly(other.effective_to) : null;
    const overlaps = (!to || otherFrom <= to) && (!otherTo || from <= otherTo);
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

    if (sameRange && sameCommission && sameFees) {
      return { type: "exact", existing: other, reason: buildOverlapReason(card, other, "exact") };
    }

    return { type: "similar", existing: other, reason: buildOverlapReason(card, other, "similar") };
  }

  return null;
}

export async function analyzeRateCard(
  client: SupabaseClient,
  body: RateCardPayload,
  options?: {
    existingCards?: NormalizedCard[];
    additionalCards?: NormalizedCard[];
    tempId?: string;
    includeArchivedForBlocking?: boolean;
  }
): Promise<RateCardAnalysis> {
  const errors: string[] = [];

  const normalized: NormalizedCard = {
    id: body.id ?? options?.tempId ?? null,
    platform_id: canonId(body.platform_id),
    category_id: canonId(body.category_id),
    commission_type: body.commission_type === "tiered" ? "tiered" : "flat",
    commission_percent:
      body.commission_type === "flat" ? toNumber(body.commission_percent) ?? 0 : null,
    slabs: body.commission_type === "tiered" ? prepareSlabs(body.slabs ?? []) : [],
    fees: prepareFees(body.fees ?? []),
    effective_from: body.effective_from,
    effective_to: body.effective_to ?? null,
    archived: false,
  };

  if (!normalized.platform_id) errors.push("platform_id is required");
  if (!normalized.category_id) errors.push("category_id is required");
  if (!body.settlement_basis) errors.push("settlement_basis is required");
  if (!body.effective_from) errors.push("effective_from is required");

  const feeCodes = normalized.fees.map((f) => f.fee_code);
  const dupFee = feeCodes.find((code, idx) => feeCodes.indexOf(code) !== idx);
  if (dupFee) {
    errors.push(`Duplicate fee code \"${dupFee}\" not allowed.`);
  }

  if (normalized.commission_type === "tiered") {
    if (!normalized.slabs.length) {
      errors.push("Tiered commission requires at least one slab.");
    } else {
      for (let i = 0; i < normalized.slabs.length; i++) {
        const current = normalized.slabs[i];
        if (current.max_price !== null && current.max_price <= current.min_price) {
          errors.push(`Slab ${i + 1}: max_price must be greater than min_price or null for open-ended.`);
        }
        if (i < normalized.slabs.length - 1) {
          const currentMax = current.max_price ?? Number.POSITIVE_INFINITY;
          if (currentMax > normalized.slabs[i + 1].min_price) {
            errors.push(`Slabs overlap between rows ${i + 1} and ${i + 2}.`);
            break;
          }
        }
      }
    }
  }

  const referenceCards = [
    ...((options?.existingCards ?? (await loadExistingRateCards(client))) ?? []),
  ];

  if (options?.additionalCards?.length) {
    referenceCards.push(...options.additionalCards);
  }

  const includeArchived = options?.includeArchivedForBlocking ?? false;
  const overlap = detectOverlap(normalized, referenceCards);

  let archivedMatch: { existing: NormalizedCard; type: "exact" | "similar"; reason: string } | undefined;
  let effectiveOverlap = overlap;

  if (overlap && overlap.existing.archived && !includeArchived) {
    archivedMatch = {
      existing: overlap.existing,
      type: overlap.type,
      reason: overlap.reason,
    };
    effectiveOverlap = null;
  }

  return {
    errors,
    overlap: effectiveOverlap,
    ...(archivedMatch ? { archivedMatch } : {}),
    normalized,
  };
}

export async function validateRateCard(client: SupabaseClient, body: RateCardPayload) {
  const analysis = await analyzeRateCard(client, body);
  const errs = [...analysis.errors];

  if (analysis.overlap) {
    errs.push(analysis.overlap.reason);
  }

  if (errs.length) {
    const error: any = new Error(errs.join(" "));
    error.statusCode = 400;
    throw error;
  }
}

export async function insertRateCardWithRelations(client: SupabaseClient, payload: RateCardPayload) {
  const commissionPercentValue =
    payload.commission_type === "flat" ? toNumber(payload.commission_percent) : null;

  const gstPercentValue =
    payload.gst_percent === undefined || payload.gst_percent === null
      ? 18
      : Number(payload.gst_percent);

  const tcsPercentValue =
    payload.tcs_percent === undefined || payload.tcs_percent === null
      ? 1
      : Number(payload.tcs_percent);

  const globalMinPriceValue =
    payload.global_min_price === undefined || payload.global_min_price === null
      ? null
      : Number(payload.global_min_price);

  const globalMaxPriceValue =
    payload.global_max_price === undefined || payload.global_max_price === null
      ? null
      : Number(payload.global_max_price);

  const { data: inserted, error: insertError } = await client
    .from("rate_cards_v2")
    .insert({
      platform_id: payload.platform_id,
      category_id: payload.category_id,
      commission_type: payload.commission_type,
      commission_percent: commissionPercentValue,
      gst_percent: gstPercentValue,
      tcs_percent: tcsPercentValue,
      settlement_basis: payload.settlement_basis,
      t_plus_days: payload.t_plus_days === undefined ? null : Number(payload.t_plus_days),
      weekly_weekday: payload.weekly_weekday === undefined ? null : Number(payload.weekly_weekday),
      bi_weekly_weekday:
        payload.bi_weekly_weekday === undefined ? null : Number(payload.bi_weekly_weekday),
      bi_weekly_which: payload.bi_weekly_which ?? null,
      monthly_day: payload.monthly_day ?? null,
      grace_days: payload.grace_days === undefined ? 0 : Number(payload.grace_days),
      effective_from: payload.effective_from,
      effective_to: payload.effective_to ?? null,
      global_min_price: globalMinPriceValue,
      global_max_price: globalMaxPriceValue,
      notes: payload.notes ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to create rate card");
  }

  const rateCardId = inserted.id;

  if (Array.isArray(payload.slabs) && payload.slabs.length > 0) {
    const slabRows = payload.slabs.map((s) => ({
      rate_card_id: rateCardId,
      min_price: Number(s.min_price ?? 0),
      max_price:
        s.max_price === undefined || s.max_price === null || s.max_price === ""
          ? null
          : Number(s.max_price),
      commission_percent: Number(s.commission_percent ?? 0),
    }));

    const { error: slabError } = await client.from("rate_card_slabs").insert(slabRows);
    if (slabError) {
      throw new Error(slabError.message ?? "Failed to insert rate card slabs");
    }
  }

  if (Array.isArray(payload.fees) && payload.fees.length > 0) {
    const feeRows = payload.fees.map((f) => ({
      rate_card_id: rateCardId,
      fee_code: f.fee_code,
      fee_type: f.fee_type,
      fee_value: Number(f.fee_value ?? 0),
    }));

    const { error: feeError } = await client.from("rate_card_fees").insert(feeRows);
    if (feeError) {
      throw new Error(feeError.message ?? "Failed to insert rate card fees");
    }
  }

  return rateCardId;
}
