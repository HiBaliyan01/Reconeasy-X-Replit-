// drizzle/returnsReconciliation.ts
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { returns, orders, rate_cards, settlements } from './schema';

export async function reconcileReturns() {
  const allReturns = await db.select().from(returns);
  const results = [];

  for (const ret of allReturns) {
    const matchedOrder = await db.select().from(orders).where(eq(orders.order_id, ret.order_id)).then(res => res[0]);
    const rateCard = matchedOrder
      ? await db.select().from(rate_cards).where(and(eq(rate_cards.marketplace, matchedOrder.marketplace), eq(rate_cards.sku, matchedOrder.sku))).then(res => res[0])
      : null;
    const settlement = await db.select().from(settlements).where(eq(settlements.return_id, ret.return_id)).then(res => res[0]);

    results.push({
      return_id: ret.return_id,
      order_id: ret.order_id,
      return_reason: ret.return_reason,
      status: ret.qc_result,
      expected_refund: rateCard ? rateCard.refund_amount : null,
      actual_refund: settlement ? settlement.refund_amount : null,
      discrepancy: (rateCard && settlement) ? (rateCard.refund_amount - settlement.refund_amount) : null,
    });
  }

  return results;
}