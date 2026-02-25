-- Add upload_batch_id and is_superseded to settlements
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS upload_batch_id uuid,
  ADD COLUMN IF NOT EXISTS is_superseded boolean DEFAULT false;

-- Index to help match per order/marketplace while ignoring superseded rows
CREATE INDEX IF NOT EXISTS settlements_order_mkt_superseded_idx
  ON settlements(order_id, marketplace, is_superseded);
