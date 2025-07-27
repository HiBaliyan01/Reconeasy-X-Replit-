import { storage } from './storage';

export interface ReconciliationResult {
  return_id: string;
  order_id: string;
  return_reason: string;
  status: string;
  expected_refund: number | null;
  actual_refund: number | null;
  discrepancy: number | null;
  marketplace: string;
  sku: string;
}

export async function reconcileReturns(): Promise<ReconciliationResult[]> {
  try {
    // Get all returns and orders from storage
    const allReturns = await storage.getReturns();
    const allOrders = await storage.getOrders();
    const allRateCards = await storage.getRateCards();
    const allSettlements = await storage.getSettlements();
    
    const results: ReconciliationResult[] = [];

    for (const returnItem of allReturns) {
      // Find matching order
      const matchedOrder = allOrders.find(order => order.orderId === returnItem.orderId);
      
      // Find applicable rate card based on marketplace and category
      const rateCard = allRateCards.find(card => 
        card.platform.toLowerCase() === returnItem.marketplace.toLowerCase() &&
        card.category // We don't have SKU-specific rate cards in current schema
      );
      
      // Find settlement for this return
      const settlement = allSettlements.find(s => 
        s.order_id === returnItem.orderId || 
        s.utr_number?.includes(returnItem.returnId)
      );

      // Calculate expected refund based on rate card and order data
      let expectedRefund = null;
      if (matchedOrder && rateCard) {
        // Basic calculation: selling price minus fees
        const sellingPrice = matchedOrder.sellingPrice || 0;
        const commissionRate = rateCard.commission_rate || 0;
        const commission = (sellingPrice * commissionRate) / 100;
        
        expectedRefund = Math.round(sellingPrice - commission);
      } else if (returnItem.refundAmount) {
        // Use the refund amount from return data if available
        expectedRefund = returnItem.refundAmount;
      }

      // Get actual refund from settlement or return data
      const actualRefund = settlement?.paid_amount || returnItem.refundAmount || null;
      
      // Calculate discrepancy
      const discrepancy = (expectedRefund && actualRefund) 
        ? expectedRefund - actualRefund 
        : null;

      results.push({
        return_id: returnItem.returnId,
        order_id: returnItem.orderId,
        return_reason: returnItem.returnReasonDesc || returnItem.returnReasonCode || 'Unknown',
        status: returnItem.returnStatus || 'pending',
        expected_refund: expectedRefund,
        actual_refund: actualRefund,
        discrepancy: discrepancy,
        marketplace: returnItem.marketplace,
        sku: returnItem.sku
      });
    }

    return results;
  } catch (error) {
    console.error('Error during returns reconciliation:', error);
    throw new Error('Failed to reconcile returns');
  }
}