import { getRateCardForOrder } from "@shared/rateCards/v2";
import { computeExpectedPayout } from "@shared/reconciliation/computeExpectedPayout";

type ReconcileInput = {
  orderId?: string;
  marketplace: string;
  category: string;
  orderDate: string; // ISO string
  deliveryDate: string; // ISO string
  actualPayoutDate: string | null; // ISO string or null
  templateType?: string | null;
};

type ReconcileStatus = "PENDING" | "DELAYED" | "SETTLED";

type ReconcileResult = {
  orderId?: string;
  marketplace: string;
  category: string;
  orderActivityDate: string;
  rateCardId: string | null;
  expectedPayoutDate: string | null;
  delayThresholdDate: string | null;
  status: ReconcileStatus;
  gross_order_value: number;
  expected_commission_amount: number;
  expected_platform_fee_amount: number;
  expected_collection_fee_amount: number;
  expected_total_deductions: number;
  expected_net_payout: number;
};

const asDateIso = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString().slice(0, 10);
};

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function reconcileOrder(db: any, params: ReconcileInput): Promise<ReconcileResult> {
  const orderActivityDate = asDateIso(params.deliveryDate) ?? asDateIso(params.orderDate) ?? new Date().toISOString().slice(0, 10);
  const rateCard = await getRateCardForOrder(
    db,
    params.marketplace,
    params.category,
    orderActivityDate,
    params.templateType ?? null,
  );

  const rateCardId = rateCard?.card?.id ?? null;
  const tPlusDays = rateCard?.card?.t_plus_days ?? 0;
  const graceDays = rateCard?.card?.grace_days ?? 0;
  const tPlusDaysNum = Number(tPlusDays ?? 0) || 0;
  const graceDaysNum = Number(graceDays ?? 0) || 0;

  const expectedPayoutDate = rateCard ? addDays(orderActivityDate, tPlusDaysNum) : null;
  const delayThresholdDate = rateCard ? addDays(orderActivityDate, tPlusDaysNum + graceDaysNum) : null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const actualPayoutIso = asDateIso(params.actualPayoutDate);

  let status: ReconcileStatus = "PENDING";

  if (expectedPayoutDate) {
    if (actualPayoutIso) {
      status = actualPayoutIso <= expectedPayoutDate ? "SETTLED" : "DELAYED";
    } else {
      status = todayIso <= expectedPayoutDate ? "PENDING" : "DELAYED";
    }
  }

  const payoutCalc =
    rateCard && rateCard.card
      ? computeExpectedPayout({
          order: {
            selling_price: (params as any)?.selling_price,
            quantity: (params as any)?.quantity,
          },
          rateCard,
        })
      : {
          gross_order_value: 0,
          expected_commission_amount: 0,
          expected_platform_fee_amount: 0,
          expected_collection_fee_amount: 0,
          expected_total_deductions: 0,
          expected_net_payout: 0,
        };

  return {
    orderId: params.orderId,
    marketplace: params.marketplace,
    category: params.category,
    orderActivityDate,
    rateCardId,
    expectedPayoutDate,
    delayThresholdDate,
    status,
    ...payoutCalc,
  };
}

export default reconcileOrder;
