export interface ReturnOrder {
  order_id: string;
  return_id: string;
  marketplace: 'Amazon' | 'Flipkart' | 'Myntra' | 'Ajio' | 'Nykaa';
  status: 'Delivered' | 'RTO' | 'Return' | 'Replacement' | 'Cancelled';
  return_type: 'customer_return' | 'rto' | 'fraud' | 'damage' | 'not_received';
  return_reason: string;
  seller_paid: boolean;
  loss_amount: number;
  refund_amount: number;
  claim_status: 'not_filed' | 'filed' | 'approved' | 'rejected' | 'pending';
  claim_amount: number;
  sku: string;
  product_name: string;
  order_date: string;
  return_date: string;
  expected_settlement_date?: string;
  wms_received: boolean;
  wms_fraudulent: boolean;
  sla_days: number;
  pincode: string;
  customer_email: string;
}

export interface ReturnCategories {
  customer_returns: ReturnOrder[];
  rto_returns: ReturnOrder[];
  fraud_damage_returns: ReturnOrder[];
  not_received_returns: ReturnOrder[];
  claims_filed: ReturnOrder[];
  unreimbursed_losses: ReturnOrder[];
}

export interface ReturnMetrics {
  total_returns: number;
  total_loss_amount: number;
  total_claims_filed: number;
  total_claims_approved: number;
  pending_reimbursements: number;
  recovery_rate: number;
}