const headerMapEntries: Array<[string, string]> = [
  // Core identifiers
  ["marketplace", "platform"],
  ["platform", "platform"],
  ["platform id", "platform"],
  ["category", "category"],
  ["category id", "category"],
  ["type", "type"],
  ["commission type", "type"],
  ["commission", "commission"],
  ["commission %", "commission"],
  ["commission (tier)", "commission"],
  ["commission percent", "commission"],
  ["min price", "minPrice"],
  ["min price ₹", "minPrice"],
  ["max price", "maxPrice"],
  ["max price ₹", "maxPrice"],
  ["valid from", "validFrom"],
  ["date from", "validFrom"],
  ["effective from", "validFrom"],
  ["valid to", "validTo"],
  ["date to", "validTo"],
  ["effective to", "validTo"],

  // Financials
  ["fixed fee", "fixedFee"],
  ["fixed fee ₹", "fixedFee"],
  ["logistics fee", "logisticsFee"],
  ["logistics fee ₹", "logisticsFee"],
  ["return logistics fee", "returnLogisticsFee"],
  ["storage fee", "storageFee"],
  ["storage fee ₹", "storageFee"],
  ["collection fee %", "collectionFeePercent"],
  ["tech fee", "techFee"],
  ["tech fee ₹", "techFee"],
  ["cancellation fee ₹", "cancellationFee"],
  ["damage/dispute deduction %", "disputeDeductionPercent"],
  ["tcs %", "tcsPercent"],
  ["gst %", "gstPercent"],
  ["penalty type", "penaltyType"],
  ["penalty value", "penaltyValue"],
  ["penalty value ₹", "penaltyValue"],
  ["discount / promo contribution %", "promoContributionPercent"],
  ["return window (days)", "returnWindowDays"],
  ["settlement cycle (days)", "settlementCycleDays"],
  ["settlement cycle", "settlementCycleDays"],
  ["settlement cycle days", "settlementCycleDays"],
  ["utr prefix", "utrPrefix"],

  // Operational
  ["settlement basis", "settlementBasis"],
  ["t+ days", "tPlusDays"],
  ["t plus days", "tPlusDays"],
  ["t days", "tPlusDays"],
  ["weekly weekday", "weeklyWeekday"],
  ["bi weekly weekday", "biWeeklyWeekday"],
  ["bi-weekly weekday", "biWeeklyWeekday"],
  ["bi weekly which", "biWeeklyWhich"],
  ["monthly day", "monthlyDay"],
  ["grace days", "graceDays"],
  ["global min price", "globalMinPrice"],
  ["global max price", "globalMaxPrice"],
  ["notes", "notes"],

  // Complex objects
  ["slabs", "slabs"],
  ["slabs json", "slabsJson"],
  ["fees", "fees"],
  ["fees json", "feesJson"],
];

const friendlyFieldAliases: Record<string, string[]> = {
  platform: ["platform_id"],
  category: ["category_id"],
  commission: ["commission_percent"],
  type: ["commission_type"],
  validFrom: ["effective_from"],
  validTo: ["effective_to"],
  minPrice: ["min_price"],
  maxPrice: ["max_price"],
  fixedFee: ["fixed_fee"],
  logisticsFee: ["logistics_fee"],
  returnLogisticsFee: ["return_logistics_fee"],
  storageFee: ["storage_fee"],
  collectionFeePercent: ["collection_fee_percent"],
  techFee: ["tech_fee"],
  cancellationFee: ["cancellation_fee"],
  disputeDeductionPercent: ["dispute_deduction_percent"],
  tcsPercent: ["tcs_percent"],
  gstPercent: ["gst_percent"],
  penaltyType: ["penalty_type"],
  penaltyValue: ["penalty_value"],
  promoContributionPercent: ["promo_contribution_percent"],
  returnWindowDays: ["return_window_days"],
  settlementCycleDays: ["settlement_cycle_days"],
  utrPrefix: ["utr_prefix"],
  settlementBasis: ["settlement_basis"],
  tPlusDays: ["t_plus_days"],
  weeklyWeekday: ["weekly_weekday"],
  biWeeklyWeekday: ["bi_weekly_weekday"],
  biWeeklyWhich: ["bi_weekly_which"],
  monthlyDay: ["monthly_day"],
  graceDays: ["grace_days"],
  globalMinPrice: ["global_min_price"],
  globalMaxPrice: ["global_max_price"],
  slabs: ["slabs_json"],
  fees: ["fees_json"],
};

export function canonicalColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[₹%()]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const headerMap = headerMapEntries.reduce<Record<string, string>>((acc, [key, value]) => {
  acc[canonicalColumnName(key)] = value;
  return acc;
}, {});

const seenUnmappedColumns = new Set<string>();

export function normalizeHeaders(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...row };
  for (const key of Object.keys(row)) {
    const canonical = canonicalColumnName(key);
    if (!canonical) continue;
    const mappedKey = headerMap[canonical];
    if (mappedKey) {
      normalized[mappedKey] = row[key];
      const aliases = friendlyFieldAliases[mappedKey];
      if (aliases) {
        for (const alias of aliases) {
          normalized[alias] = row[key];
        }
      }
    }
    normalized[canonical] = row[key];
    if (!mappedKey && !seenUnmappedColumns.has(key)) {
      seenUnmappedColumns.add(key);
      console.warn("⚠️ Unmapped CSV column:", key);
    }
  }
  return normalized;
}

export default normalizeHeaders;
