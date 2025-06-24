import { Transaction, Return } from '../types';

export const matchTransactionsByUTR = (transactions: Transaction[], utr: string): Transaction[] => {
  return transactions.filter(transaction => transaction.utr === utr);
};

export const detectDiscrepancies = (transactions: Transaction[]): Transaction[] => {
  return transactions.filter(transaction => {
    // Simulate discrepancy detection logic
    // In real implementation, this would compare with bank statements
    return Math.random() < 0.1; // 10% chance of discrepancy for demo
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