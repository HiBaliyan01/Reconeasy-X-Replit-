import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { rateCardsV2, rateCardSlabs, rateCardFees } from "../schema";
import { normalizeKey } from "../utils/normalizeKey";

export interface RateCardV2Row {
  id: string;
  platform_id: string | null;
  category_id: string | null;
  commission_type: "flat" | "tiered";
  commission_percent: number | string | null;
  archived: boolean | null;
  version_number?: number | string | null;
  gst_percent: number | string | null;
  tcs_percent: number | string | null;
  settlement_basis: string | null;
  t_plus_days: number | string | null;
  weekly_weekday: number | string | null;
  bi_weekly_weekday: number | string | null;
  bi_weekly_which: string | null;
  monthly_day: string | null;
  grace_days: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
  global_min_price: number | string | null;
  global_max_price: number | string | null;
  notes: string | null;
  template_type?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RateCardV2Normalized extends RateCardV2Row {
  commission_percent: number | null;
  archived: boolean;
  version_number: number;
  gst_percent: number | null;
  tcs_percent: number | null;
  settlement_basis: string | null;
  t_plus_days: number | null;
  weekly_weekday: number | null;
  bi_weekly_weekday: number | null;
  bi_weekly_which: string | null;
  monthly_day: string | null;
  grace_days: number;
  effective_from: string | null;
  effective_to: string | null;
  global_min_price: number | null;
  global_max_price: number | null;
  notes: string | null;
  template_type?: string | null;
  status: "active" | "upcoming" | "expired" | "archived";
}

export interface RateCardV2Metrics {
  total: number;
  active: number;
  expired: number;
  upcoming: number;
  archived: number;
  avg_flat_commission: number;
  flat_count: number;
}

export interface RateCardV2Response {
  data: RateCardV2Normalized[];
  metrics: RateCardV2Metrics;
}

export interface RateCardWithRelations {
  card: RateCardV2Normalized;
  slabs: {
    id: string;
    rate_card_id: string;
    min_price: number;
    max_price: number | null;
    commission_percent: number;
  }[];
  fees: {
    id: string;
    rate_card_id: string;
    fee_code: string;
    fee_type: "percent" | "amount";
    fee_value: number;
    applies_to_fulfillment_type: string | null;
    min_price: number | null;
    max_price: number | null;
  }[];
}

function toOptionalNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toNumberOrZero(value: string | number | null | undefined) {
  const parsed = toOptionalNumber(value);
  return parsed === null ? 0 : parsed;
}

export function transformRateCardV2Rows(rows: RateCardV2Row[], now = new Date()): RateCardV2Response {
  const today = new Date(now);

  const data: RateCardV2Normalized[] = rows.map((row) => {
    const commissionPercent = toOptionalNumber(row.commission_percent);
    const gstPercent = toOptionalNumber(row.gst_percent);
    const tcsPercent = toOptionalNumber(row.tcs_percent);
    const graceDays = toNumberOrZero(row.grace_days);
    const globalMinPrice = toOptionalNumber(row.global_min_price);
    const globalMaxPrice = toOptionalNumber(row.global_max_price);
    const settlementBasis = row.settlement_basis ?? null;
    const tPlusDays = toOptionalNumber(row.t_plus_days);
    const weeklyWeekday = toOptionalNumber(row.weekly_weekday);
    const biWeeklyWeekday = toOptionalNumber(row.bi_weekly_weekday);
    const versionNumber = toOptionalNumber(row.version_number ?? 1) ?? 1;

    const status = (() => {
      const fromDate = row.effective_from ? new Date(row.effective_from) : today;
      const toDate = row.effective_to ? new Date(row.effective_to) : null;
      if (row.archived) return "archived" as const;
      if (fromDate > today) return "upcoming" as const;
      if (toDate && toDate < today) return "expired" as const;
      return "active" as const;
    })();

    return {
      ...row,
      commission_percent: commissionPercent,
      archived: row.archived ?? false,
      version_number: versionNumber,
      gst_percent: gstPercent,
      tcs_percent: tcsPercent,
      settlement_basis: settlementBasis,
      t_plus_days: tPlusDays,
      weekly_weekday: weeklyWeekday,
      bi_weekly_weekday: biWeeklyWeekday,
      bi_weekly_which: row.bi_weekly_which ?? null,
      monthly_day: row.monthly_day ?? null,
      grace_days: graceDays,
      global_min_price: globalMinPrice,
      global_max_price: globalMaxPrice,
      notes: row.notes ?? null,
      status,
    };
  });

  const total = data.length;
  const archivedCount = data.filter((c) => c.archived).length;
  const active = data.filter((c) => !c.archived && c.status === "active").length;
  const expired = data.filter((c) => !c.archived && c.status === "expired").length;
  const upcoming = data.filter((c) => !c.archived && c.status === "upcoming").length;
  const flatCards = data.filter((c) => c.commission_type === "flat" && typeof c.commission_percent === "number");
  const flatSum = flatCards.reduce((sum, c) => sum + (c.commission_percent ?? 0), 0);
  const flatCount = flatCards.length;
  const avgFlat = flatCount ? Number((flatSum / flatCount).toFixed(2)) : 0;

  return {
    data,
    metrics: {
      total,
      active,
      expired,
      upcoming,
      archived: archivedCount,
      avg_flat_commission: avgFlat,
      flat_count: flatCount,
    },
  };
}

export function selectLatestActiveRateCards(cards: RateCardV2Normalized[]): RateCardV2Normalized[] {
  const groups = new Map<string, RateCardV2Normalized[]>();
  for (const card of cards) {
    if (card.archived) continue;
    if (card.status !== "active" && card.status !== "upcoming") continue;
    const key = [card.platform_id, card.category_id, card.commission_type, card.template_type ?? "none"].join("|");
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  const latest: RateCardV2Normalized[] = [];
  for (const list of Array.from(groups.values())) {
    list.sort((a: RateCardV2Normalized, b: RateCardV2Normalized) => (b.version_number ?? 1) - (a.version_number ?? 1));
    latest.push(list[0]);
  }
  return latest;
}

export async function getRateCardForOrder(
  db: any,
  platformId: string,
  categoryId: string,
  orderActivityDate: string,
  templateType?: "flat" | "tiered" | string | null,
  tenantId?: string | null,
): Promise<RateCardWithRelations | null> {
  const dateIso = (orderActivityDate ?? new Date().toISOString()).slice(0, 10);
  const normalizedPlatform = normalizeKey(platformId);
  const normalizedCategory = normalizeKey(categoryId);

  const whereClauses = [
    sql`lower(${rateCardsV2.platform_id}) = ${normalizedPlatform}`,
    sql`lower(${rateCardsV2.category_id}) = ${normalizedCategory}`,
    eq(rateCardsV2.archived, false),
    lte(rateCardsV2.effective_from, dateIso),
    or(isNull(rateCardsV2.effective_to), gte(rateCardsV2.effective_to, dateIso)),
  ];

  // Fix: actually apply tenant scoping when tenantId is provided
  if (tenantId) {
    whereClauses.push(eq(rateCardsV2.tenant_id, tenantId));
  }

  if (templateType) {
    whereClauses.push(eq(rateCardsV2.template_type, templateType));
  }

  const candidates = await db
    .select()
    .from(rateCardsV2)
    .where(and(...whereClauses))
    .orderBy(desc(rateCardsV2.created_at))
    .limit(1);

  if (!candidates.length) return null;
  const cardRow = candidates[0];

  const slabs = await db
    .select()
    .from(rateCardSlabs)
    .where(eq(rateCardSlabs.rate_card_id, cardRow.id));

  const fees = await db
    .select()
    .from(rateCardFees)
    .where(eq(rateCardFees.rate_card_id, cardRow.id));

  const normalized = transformRateCardV2Rows([cardRow]).data[0];

  return {
    card: normalized,
    slabs: slabs.map((s: any) => ({
      id: s.id,
      rate_card_id: s.rate_card_id,
      min_price: Number(s.min_price ?? 0),
      max_price: s.max_price === null || s.max_price === undefined ? null : Number(s.max_price),
      commission_percent: Number(s.commission_percent ?? 0),
    })),
    fees: fees.map((f: any) => ({
      id: f.id,
      rate_card_id: f.rate_card_id,
      fee_code: f.fee_code,
      fee_type: f.fee_type === "amount" ? "amount" : "percent",
      fee_value: Number(f.fee_value ?? 0),
      applies_to_fulfillment_type: f.applies_to_fulfillment_type ?? null,
      min_price: f.min_price !== null ? Number(f.min_price) : null,
      max_price: f.max_price !== null ? Number(f.max_price) : null,
    })),
  };
}
