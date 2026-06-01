const FIELD_ALIASES: Record<string, string> = {
  'order-id': 'order_id',
  order_id: 'order_id',
  'amazon-order-id': 'order_id',
  'Order ID': 'order_id',
  OrderId: 'order_id',

  'return-id': 'return_id',
  return_id: 'return_id',
  'Return ID': 'return_id',
  'rma-id': 'return_id',

  sku: 'sku',
  SKU: 'sku',
  'seller-sku': 'sku',
  'Seller SKU': 'sku',

  'return-date': 'return_date',
  return_date: 'return_date',
  'Return Date': 'return_date',
  returnDate: 'return_date',

  quantity: 'qty_returned',
  qty_returned: 'qty_returned',
  'qty-returned': 'qty_returned',
  Quantity: 'qty_returned',
  'units-returned': 'qty_returned',

  'return-reason': 'return_reason',
  return_reason: 'return_reason',
  return_reason_desc: 'return_reason',
  'Return Reason': 'return_reason',
  reason: 'return_reason',

  'refund-amount': 'refund_amount',
  refund_amount: 'refund_amount',
  'Refund Amount': 'refund_amount',
  refundAmount: 'refund_amount',

  'commission-reversal': 'commission_reversal',
  commission_reversal: 'commission_reversal',
  'referral-fee-reversal': 'commission_reversal',
  RefundCommission: 'commission_reversal',

  'logistics-reversal': 'logistics_reversal',
  logistics_reversal: 'logistics_reversal',
  'shipping-reversal': 'logistics_reversal',

  'return-status': 'return_status',
  return_status: 'return_status',
  'Return Status': 'return_status',
  status: 'return_status',

  marketplace: 'marketplace',
  Marketplace: 'marketplace',

  'fulfillment-channel': 'fulfillment_type',
  fulfillment_type: 'fulfillment_type',
  'Fulfillment Channel': 'fulfillment_type',
  'fulfillment-type': 'fulfillment_type',
};

const FULFILLMENT_ALIASES: Record<string, string> = {
  FBA: 'FBA',
  AFN: 'FBA',
  AMAZON: 'FBA',
  EASY_SHIP: 'EASY_SHIP',
  EasyShip: 'EASY_SHIP',
  'EASY SHIP': 'EASY_SHIP',
  EASYSHIP: 'EASY_SHIP',
  SELF_SHIP: 'SELF_SHIP',
  'SELF SHIP': 'SELF_SHIP',
  SELFSHIP: 'SELF_SHIP',
  MFN: 'SELF_SHIP',
  MERCHANT: 'SELF_SHIP',
};

export const REQUIRED_FIELDS = ['order_id', 'return_id', 'sku', 'return_date', 'qty_returned'];

export function mapReturnsCsvRow(rawRow: Record<string, string>) {
  const mapped: Record<string, any> = {};

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normalizedKey = FIELD_ALIASES[rawKey] || FIELD_ALIASES[rawKey.trim()] || null;
    if (normalizedKey) {
      mapped[normalizedKey] = value;
    }
  }

  if (mapped.fulfillment_type) {
    const normalizedFulfillment = String(mapped.fulfillment_type).trim().toUpperCase().replace(/-/g, '_');
    mapped.fulfillment_type = FULFILLMENT_ALIASES[normalizedFulfillment] || null;
  }

  return mapped;
}

export function validateMappedRow(row: Record<string, any>): string[] {
  return REQUIRED_FIELDS.filter((field) => !row[field]);
}
