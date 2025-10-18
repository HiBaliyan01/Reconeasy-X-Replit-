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

export interface LegacyRateCardRow {
  id: string;
  platform: string;
  category: string;
  commission_rate?: string | number | null;
  commission_percent?: string | number | null;
  commission_type?: string | null;
  shipping_fee?: string | number | null;
  gst_rate?: string | number | null;
  rto_fee?: string | number | null;
  packaging_fee?: string | number | null;
  fixed_fee?: string | number | null;
  min_price?: string | number | null;
  max_price?: string | number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  promo_discount_fee?: string | number | null;
  territory_fee?: string | number | null;
  notes?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface LegacyRateCard extends LegacyRateCardRow {
  commission_type: "flat" | "tiered";
  commission_percent: number | null;
  commission_rate: number | null;
  shipping_fee: number | null;
  gst_rate: number | null;
  rto_fee: number | null;
  packaging_fee: number | null;
  fixed_fee: number | null;
  min_price: number | null;
  max_price: number | null;
  promo_discount_fee: number | null;
  territory_fee: number | null;
  status: "active" | "upcoming" | "expired";
  platform_name: string;
  category_name: string;
}

export interface LegacyRateCardResponse {
  data: LegacyRateCard[];
  metrics: {
    total: number;
    active: number;
    expired: number;
    upcoming: number;
    avg_flat_commission: number;
    flat_count: number;
  };
}

function toOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toNumberOrZero(value: unknown): number {
  const parsed = toOptionalNumber(value);
  return parsed === null ? 0 : parsed;
}

export function transformLegacyRateCards(rows: LegacyRateCardRow[], now = new Date()): LegacyRateCardResponse {
  const today = new Date(now);

  const data: LegacyRateCard[] = rows.map((row) => {
    const commissionPercent =
      toOptionalNumber(row.commission_percent) ?? toOptionalNumber(row.commission_rate);
    const commissionTypeRaw = (row.commission_type ?? (commissionPercent !== null ? "flat" : "tiered")) as
      | "flat"
      | "tiered"
      | string
      | null;

    const from = row.effective_from ? new Date(row.effective_from) : today;
    const to = row.effective_to ? new Date(row.effective_to) : null;

    let status: "active" | "upcoming" | "expired" = "active";
    if (from > today) status = "upcoming";
    else if (to && to < today) status = "expired";

    const normalized: LegacyRateCard = {
      ...row,
      commission_type: commissionTypeRaw === "tiered" ? "tiered" : "flat",
      commission_percent: commissionPercent,
      commission_rate: commissionPercent,
      shipping_fee: toOptionalNumber(row.shipping_fee),
      gst_rate: toOptionalNumber(row.gst_rate),
      rto_fee: toOptionalNumber(row.rto_fee),
      packaging_fee: toOptionalNumber(row.packaging_fee),
      fixed_fee: toOptionalNumber(row.fixed_fee),
      min_price: toOptionalNumber(row.min_price),
      max_price: toOptionalNumber(row.max_price),
      promo_discount_fee: toOptionalNumber(row.promo_discount_fee),
      territory_fee: toOptionalNumber(row.territory_fee),
      status,
      platform_name: PLATFORM_LABELS[row.platform as keyof typeof PLATFORM_LABELS] ?? row.platform,
      category_name: CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category,
    };

    return normalized;
  });

  const total = data.length;
  const active = data.filter((c) => c.status === "active").length;
  const expired = data.filter((c) => c.status === "expired").length;
  const upcoming = data.filter((c) => c.status === "upcoming").length;

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
      avg_flat_commission: avgFlat,
      flat_count: flatCount,
    },
  };
}
