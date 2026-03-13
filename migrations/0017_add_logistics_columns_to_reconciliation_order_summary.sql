ALTER TABLE reconciliation_order_summary
  ADD COLUMN IF NOT EXISTS expected_logistics NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_logistics NUMERIC,
  ADD COLUMN IF NOT EXISTS logistics_discrepancy NUMERIC,
  ADD COLUMN IF NOT EXISTS logistics_status TEXT;
