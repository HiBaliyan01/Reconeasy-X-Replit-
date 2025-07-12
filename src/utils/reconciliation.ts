import { Transaction, Return } from '../types';
import { RateCard, calculateExpectedAmount } from './supabase';

export const matchTransactionsByUTR = (transactions: Transaction[], utr: string): Transaction[] => {
  return transactions.filter(transaction => transaction.utr === utr);
};

export const detectDiscrepancies = (
  transactions: Transaction[],
  rateCards: RateCard[] = []
): Transaction[] => {
  return transactions.filter(transaction => {
    // If we have rate cards, use them to calculate expected amount
    if (rateCards.length > 0) {
      // Assuming transaction has category and marketplace properties
      const category = transaction.variant?.color || 'Default';
      const { expected } = calculateExpectedAmount(
        transaction.amount,
        transaction.marketplace,
        category,
        rateCards
      );
      
      // Check if there's a significant discrepancy (e.g., more than 1%)
      const discrepancy = Math.abs(expected - transaction.amount);
      const discrepancyPercent = (discrepancy / transaction.amount) * 100;
      
      return discrepancyPercent > 1;
    } else {
      // Fallback to random detection if no rate cards
      return Math.random() < 0.1; // 10% chance of discrepancy for demo
    }
  });
};

export const categorizeReturnReason = (reason: string): string => {
  const lowerReason = reason.toLowerCase();
  
  if (lowerReason.includes('size') || lowerReason.includes('fit')) {
    return 'size_issue';
  } else if (lowerReason.includes('quality') || lowerReason.includes('defect')) {
    return 'quality_issue';
  } else if (lowerReason.includes('wrong') || lowerReason.includes('different')) {
    return 'wrong_item';
  } else if (lowerReason.includes('damage') || lowerReason.includes('broken')) {
    return 'damaged';
  } else if (lowerReason.includes('description') || lowerReason.includes('expect')) {
    return 'not_as_described';
  } else {
    return 'other';
  }
};

export const calculateReturnRate = (totalOrders: number, totalReturns: number): number => {
  if (totalOrders === 0) return 0;
  return (totalReturns / totalOrders) * 100;
};

export const processReconciliation = (transactions: Transaction[]): {
  reconciled: Transaction[];
  pending: Transaction[];
  discrepancies: Transaction[];
} => {
  const reconciled = transactions.filter(t => t.status === 'reconciled');
  const pending = transactions.filter(t => t.status === 'pending');
  const discrepancies = transactions.filter(t => t.status === 'discrepancy');
  
  return { reconciled, pending, discrepancies };
};

export const calculateSettlementAmount = (
  transaction: Transaction,
  rateCards: RateCard[] = []
): {
  expected: number;
  commission: number;
  shipping: number;
  gst: number;
  discrepancy: number;
  rateCardFound: boolean;
} => {
  // Default values if no rate card is found
  let expected = transaction.amount;
  let commission = 0;
  let shipping = 0;
  let gst = 0;
  let rateCardFound = false;
  
  // If we have rate cards, use them to calculate expected amount
  if (rateCards.length > 0) {
    // Use variant color as category if available, otherwise use a default
    const category = transaction.variant?.color || 'Default';
    
    const result = calculateExpectedAmount(
      transaction.amount,
      transaction.marketplace,
      category,
      rateCards
    );
    
    expected = result.expected;
    commission = result.commission;
    shipping = result.shipping;
    gst = result.gst;
    rateCardFound = result.rateCardFound;
  }
  
  // Calculate discrepancy
  const discrepancy = expected - transaction.amount;
  
  return {
    expected,
    commission,
    shipping,
    gst,
    discrepancy,
    rateCardFound
  };
};