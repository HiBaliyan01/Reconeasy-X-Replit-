import { RateCardWithRelations } from "../rateCards/v2";

type OrderInput = {
  selling_price?: number | string | null;
  quantity?: number | string | null;
  fulfillment_type?: string | null;
};

export type ExpectedPayoutResult = {
  gross_order_value: number;
  expected_commission_amount: number;
  commission_rate_applied: number;
  commission_slab_applied: string | null;
  expected_platform_fee_amount: number;
  expected_collection_fee_amount: number;
  expected_closing_fee_amount: number;
  closing_fee_source: string | null;
  expected_gst_amount: number;
  expected_tcs_amount: number;
  expected_total_deductions: number;
  expected_net_payout: number;
  confidence: "EXACT" | "HIGH" | "MEDIUM" | "LOW";
  missing_rule_codes: string[];
  calculation_notes: string[];
};

export function computeExpectedPayout({
  order,
  rateCard,
}: {
  order: OrderInput;
  rateCard: RateCardWithRelations;
}): ExpectedPayoutResult {
  const quantity = Math.max(Number(order.quantity ?? 1) || 1, 0);
  const price = Math.max(Number(order.selling_price ?? 0) || 0, 0);
  const fulfillmentType = (order.fulfillment_type ?? "").toUpperCase();
  const gross_order_value = price * quantity;

  const missingRuleCodes: string[] = [];
  const calculationNotes: string[] = [];

  // Commission
  let commissionPercent = 0;
  let commissionSlabApplied: string | null = null;

  if (rateCard.card.commission_type === "flat") {
    commissionPercent = Number(rateCard.card.commission_percent ?? 0) || 0;
    commissionSlabApplied = `flat:${commissionPercent}%`;
  } else {
    const slabs = rateCard.slabs || [];
    const matching = slabs.find((slab) => {
      const min = Number(slab.min_price ?? 0);
      const max = slab.max_price === null ? null : Number(slab.max_price);
      if (Number.isNaN(min)) return false;
      if (max === null || Number.isNaN(max)) return gross_order_value >= min;
      return gross_order_value >= min && gross_order_value <= max;
    });

    if (matching) {
      commissionPercent = Number(matching.commission_percent ?? 0) || 0;
      const maxLabel = matching.max_price === null ? "∞" : `₹${matching.max_price}`;
      commissionSlabApplied = `tiered:₹${matching.min_price}-${maxLabel}:${commissionPercent}%`;
    } else {
      missingRuleCodes.push("commission_slab");
      calculationNotes.push("No matching commission slab found for order value");
    }
  }

  const expected_commission_amount = gross_order_value * (commissionPercent / 100);

  // Fees from rate_card_fees
  const fees = rateCard.fees || [];

  const findFee = (code: string, amount?: number) => {
    return fees.find((f) => {
      if (f.fee_code !== code) return false;

      if (f.applies_to_fulfillment_type) {
        if (f.applies_to_fulfillment_type.toUpperCase() !== fulfillmentType) return false;
      }

      if (f.min_price !== null && amount !== undefined && amount < f.min_price) return false;
      if (f.max_price !== null && amount !== undefined && amount > f.max_price) return false;

      return true;
    });
  };

  const calcFeeAmount = (fee: (typeof fees)[0]) => {
    if (!fee) return 0;
    return fee.fee_type === "percent"
      ? gross_order_value * (Number(fee.fee_value) / 100)
      : Number(fee.fee_value) || 0;
  };

  const techFee = findFee("tech") || findFee("technology") || findFee("platform");
  const expected_platform_fee_amount = techFee ? calcFeeAmount(techFee) : 0;
  if (!techFee) {
    calculationNotes.push("No platform/tech fee configured — excluded from calculation");
  }

  const collectionFee = findFee("collection");
  const expected_collection_fee_amount = collectionFee ? calcFeeAmount(collectionFee) : 0;

  const closingFee =
    findFee("closing_fee", gross_order_value) ||
    findFee("fixed_fee", gross_order_value) ||
    findFee("closing", gross_order_value);

  let expected_closing_fee_amount = 0;
  let closingFeeSource: string | null = null;

  if (closingFee) {
    expected_closing_fee_amount = calcFeeAmount(closingFee);
    closingFeeSource = `rate_card_fees:${closingFee.id}`;
  } else {
    missingRuleCodes.push("closing_fee");
    calculationNotes.push(
      `No closing fee rule found for fulfillment_type=${fulfillmentType || "unknown"} ` +
        `price=₹${gross_order_value} — excluded from calculation`,
    );
  }

  // GST on fees
  const gstPercent = Number(rateCard.card.gst_percent ?? 0) || 0;
  const feesSubjectToGst =
    expected_commission_amount + expected_platform_fee_amount + expected_closing_fee_amount;
  const expected_gst_amount = feesSubjectToGst * (gstPercent / 100);

  if (gstPercent === 0) {
    calculationNotes.push("GST percent is 0 or not configured in rate card");
  }

  // TCS
  const tcsPercent = Number(rateCard.card.tcs_percent ?? 0) || 0;
  const expected_tcs_amount = gross_order_value * (tcsPercent / 100);

  if (tcsPercent === 0) {
    calculationNotes.push("TCS percent is 0 or not configured in rate card");
  }

  const expected_total_deductions =
    expected_commission_amount +
    expected_platform_fee_amount +
    expected_collection_fee_amount +
    expected_closing_fee_amount +
    expected_gst_amount +
    expected_tcs_amount;

  const expected_net_payout = gross_order_value - expected_total_deductions;

  let confidence: ExpectedPayoutResult["confidence"] = "HIGH";
  if (missingRuleCodes.includes("commission_slab")) {
    confidence = "LOW";
  } else if (missingRuleCodes.includes("closing_fee") || gstPercent === 0) {
    confidence = "MEDIUM";
  } else if (missingRuleCodes.length === 0) {
    confidence = "HIGH";
  }

  return {
    gross_order_value,
    expected_commission_amount,
    commission_rate_applied: commissionPercent,
    commission_slab_applied: commissionSlabApplied,
    expected_platform_fee_amount,
    expected_collection_fee_amount,
    expected_closing_fee_amount,
    closing_fee_source: closingFeeSource,
    expected_gst_amount,
    expected_tcs_amount,
    expected_total_deductions,
    expected_net_payout,
    confidence,
    missing_rule_codes: missingRuleCodes,
    calculation_notes: calculationNotes,
  };
}
