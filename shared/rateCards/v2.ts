export interface RateCardV2Row {
  id: string;
  platform_id: string | null;
  category_id: string | null;
  commission_type: "flat" | "tiered";
  commission_percent: number | string | null;
  archived: boolean | null;
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
  created_at: string | null;
  updated_at: string | null;
}

export interface RateCardV2Normalized extends RateCardV2Row {
  commission_percent: number | null;
  archived: boolean;
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
  status: "active" | "upcoming" | "expired";
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

    const status = (() => {
      const fromDate = row.effective_from ? new Date(row.effective_from) : today;
      const toDate = row.effective_to ? new Date(row.effective_to) : null;
      if (fromDate > today) return "upcoming" as const;
      if (toDate && toDate < today) return "expired" as const;
      return "active" as const;
    })();

    return {
      ...row,
      commission_percent: commissionPercent,
      archived: row.archived ?? false,
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

