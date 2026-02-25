-- Add payout expectation columns to reconciliations_v0 (nullable)
ALTER TABLE reconciliations_v0
  ADD COLUMN IF NOT EXISTS gross_order_value double precision,
  ADD COLUMN IF NOT EXISTS expected_commission_amount double precision,
  ADD COLUMN IF NOT EXISTS expected_platform_fee_amount double precision,
  ADD COLUMN IF NOT EXISTS expected_collection_fee_amount double precision,
  ADD COLUMN IF NOT EXISTS expected_total_deductions double precision,
  ADD COLUMN IF NOT EXISTS expected_net_payout double precision;
