-- Add unique constraint for order_id, marketplace, run_id
ALTER TABLE reconciliations_v0
  ADD CONSTRAINT reconciliations_v0_order_marketplace_run_uidx UNIQUE (order_id, marketplace, run_id);
