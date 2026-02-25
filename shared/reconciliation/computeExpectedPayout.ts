import { RateCardWithRelations } from "../rateCards/v2";

type OrderInput = {
  selling_price?: number | string | null;
  quantity?: number | string | null;
};

export function computeExpectedPayout({
  order,
  rateCard,
}: {
  order: OrderInput;
  rateCard: RateCardWithRelations;
}) {
  const quantity = Number(order.quantity ?? 1);
  const qty = Number.isNaN(quantity) ? 1 : Math.max(quantity, 0);
  const sellingPrice = Number(order.selling_price ?? 0);
  const price = Number.isNaN(sellingPrice) ? 0 : Math.max(sellingPrice, 0);

  const gross_order_value = price * qty;

  // Commission
  let commissionPercent = 0;
  if (rateCard.card.commission_type === "flat") {
    commissionPercent = Number(rateCard.card.commission_percent ?? 0) || 0;
  } else {
    // tiered
    const slabs = rateCard.slabs || [];
    const matching = slabs.find((slab, idx) => {
      const min = Number(slab.min_price ?? 0);
      const max = slab.max_price === null || slab.max_price === undefined ? null : Number(slab.max_price);
      const isLast = idx === slabs.length - 1 || max === null;
      if (Number.isNaN(min)) return false;
      if (max === null || Number.isNaN(max)) {
        return gross_order_value >= min;
      }
      return gross_order_value >= min && (gross_order_value < max || (isLast && gross_order_value <= max));
    });
    commissionPercent = matching ? Number(matching.commission_percent ?? 0) || 0 : 0;
  }
  const expected_commission_amount = gross_order_value * (commissionPercent / 100);

  // Fees
  const fees = rateCard.fees || [];
  const findFee = (code: string) => fees.find((f) => f.fee_code === code);

  const techFee = findFee("tech") || findFee("technology") || findFee("platform");
  const collectionFee = findFee("collection");

  const expected_platform_fee_amount = techFee
    ? techFee.fee_type === "percent"
      ? gross_order_value * (Number(techFee.fee_value ?? 0) / 100)
      : Number(techFee.fee_value ?? 0) || 0
    : 0;

  const expected_collection_fee_amount = collectionFee
    ? collectionFee.fee_type === "percent"
      ? gross_order_value * (Number(collectionFee.fee_value ?? 0) / 100)
      : Number(collectionFee.fee_value ?? 0) || 0
    : 0;

  const expected_total_deductions =
    expected_commission_amount + expected_platform_fee_amount + expected_collection_fee_amount;
  const expected_net_payout = gross_order_value - expected_total_deductions;

  return {
    gross_order_value,
    expected_commission_amount,
    expected_platform_fee_amount,
    expected_collection_fee_amount,
    expected_total_deductions,
    expected_net_payout,
  };
}
