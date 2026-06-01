ALTER TABLE claims
DROP CONSTRAINT IF EXISTS claims_bucket_check;

ALTER TABLE claims
ADD CONSTRAINT claims_bucket_check
CHECK (bucket IN (
  'COMMISSION',
  'LOGISTICS',
  'RETURN_LOGISTICS',
  'PLATFORM_FEE',
  'PAYMENT_NOT_RECEIVED',
  'OTHER'
));

CREATE INDEX IF NOT EXISTS idx_sfl_order_tenant_amount
ON settlement_fee_lines(order_id, tenant_id, amount);
