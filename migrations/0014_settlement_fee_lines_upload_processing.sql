ALTER TABLE settlement_fee_lines
  ADD COLUMN IF NOT EXISTS order_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sfl_order_bucket
  ON settlement_fee_lines(order_id, bucket);

CREATE INDEX IF NOT EXISTS idx_sfl_order_txn
  ON settlement_fee_lines(order_id, transaction_type);

CREATE INDEX IF NOT EXISTS idx_sfl_file_id
  ON settlement_fee_lines(uploaded_file_id);
