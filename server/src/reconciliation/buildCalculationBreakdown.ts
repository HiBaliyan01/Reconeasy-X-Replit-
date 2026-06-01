import crypto from "crypto";

type BreakdownInput = {
  engineVersion: string;
  runId: string;
  rateCardId: string | null;
  rateCardVersion: number | null;
  fulfillmentType: string | null;
  sellingPrice: number;
  quantity: number;
  grossOrderValue: number;
  commission: {
    type: string;
    slabApplied: string | null;
    ratePercent: number;
    expected: number;
    actual: number;
  };
  closingFee: {
    fulfillmentType: string | null;
    expected: number;
    actual: number;
    source: string | null;
  };
  gst: {
    ratePercent: number;
    appliedOn: string;
    expected: number;
    actual: number;
  };
  tcs: {
    ratePercent: number;
    expected: number;
    actual: number;
  };
  logistics: {
    weightGrams: number | null;
    zone: string | null;
    expected: number | null;
    actual: number;
    note: string;
  };
  summary: {
    expectedNetPayout: number;
    actualNetPayout: number;
    totalDiscrepancy: number;
    status: string;
    confidence: string;
    missingRuleCodes: string[];
  };
};

export function buildCalculationBreakdown(input: BreakdownInput): {
  breakdown: object;
  hash: string;
} {
  const breakdown = {
    engine: input.engineVersion,
    run_id: input.runId,
    rate_card_id: input.rateCardId,
    rate_card_version: input.rateCardVersion,
    fulfillment_type: input.fulfillmentType,
    selling_price: input.sellingPrice,
    quantity: input.quantity,
    gross_order_value: input.grossOrderValue,
    commission: {
      type: input.commission.type,
      slab_applied: input.commission.slabApplied,
      rate_percent: input.commission.ratePercent,
      expected: input.commission.expected,
      actual: input.commission.actual,
      discrepancy: input.commission.expected - input.commission.actual,
    },
    closing_fee: {
      fulfillment_type: input.closingFee.fulfillmentType,
      expected: input.closingFee.expected,
      actual: input.closingFee.actual,
      discrepancy: input.closingFee.expected - input.closingFee.actual,
      source: input.closingFee.source,
    },
    gst: {
      rate_percent: input.gst.ratePercent,
      applied_on: input.gst.appliedOn,
      expected: input.gst.expected,
      actual: input.gst.actual,
      discrepancy: input.gst.expected - input.gst.actual,
    },
    tcs: {
      rate_percent: input.tcs.ratePercent,
      expected: input.tcs.expected,
      actual: input.tcs.actual,
      discrepancy: 0,
    },
    logistics: {
      weight_grams: input.logistics.weightGrams,
      zone: input.logistics.zone,
      expected: input.logistics.expected,
      actual: input.logistics.actual,
      note: input.logistics.note,
    },
    summary: {
      expected_net_payout: input.summary.expectedNetPayout,
      actual_net_payout: input.summary.actualNetPayout,
      total_discrepancy: input.summary.totalDiscrepancy,
      status: input.summary.status,
      confidence: input.summary.confidence,
      missing_rule_codes: input.summary.missingRuleCodes,
    },
  };

  const hash = crypto.createHash("sha256").update(JSON.stringify(breakdown)).digest("hex");

  return { breakdown, hash };
}
