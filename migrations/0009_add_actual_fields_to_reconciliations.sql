-- Add actual payout fields to reconciliations_v0
ALTER TABLE reconciliations_v0
  ADD COLUMN IF NOT EXISTS actual_payout_amount double precision,
  ADD COLUMN IF NOT EXISTS discrepancy_amount double precision,
  ADD COLUMN IF NOT EXISTS settlement_rows_count integer,
  ADD COLUMN IF NOT EXISTS last_payout_date date;
