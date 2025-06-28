export interface Transaction {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  amount: number;
  utr: string;
  status: 'pending' | 'reconciled' | 'discrepancy';
  date: string;
  customerEmail: string;
  variant?: {
    size?: string;
    color?: string;
  };
}

export interface Return {
  id: string;
  orderId: string;
  transactionId: string;
  sku: string;
  productName: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  reason: string;
  reasonCategory: 'size_issue' | 'quality_issue' | 'wrong_item' | 'damaged' | 'not_as_described' | 'other';
  refundAmount: number;
  status: 'pending' | 'processed' | 'rejected';
  date: string;
  variant?: {
    size?: string;
    color?: string;
  };
}

export interface DashboardMetrics {
  totalSales: number;
  totalReturns: number;
  returnRate: number;
  pendingReconciliations: number;
  totalDiscrepancies: number;
  averageOrderValue: number;
}

export interface ReturnForecast {
  date: string;
  predicted: number;
  actual?: number;
}

export interface Ticket {
  id: string;
  ticketId: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra';
  ticketType: 'payment_discrepancy' | 'return_issue' | 'order_issue' | 'refund_delay' | 'quality_complaint' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
  subject: string;
  description: string;
  orderId?: string;
  utr?: string;
  amount?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolutionTime?: number;
  customerEmail?: string;
  tags: string[];
  attachments?: string[];
  comments: Array<{
    id: string;
    author: string;
    message: string;
    timestamp: string;
    type: 'internal' | 'customer' | 'marketplace';
  }>;
}