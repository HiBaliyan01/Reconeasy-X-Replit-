-- Create reconciliation_runs table
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_run_id uuid REFERENCES reconciliation_runs(id),
    trigger_type text,
    status text,
    is_latest boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    total_orders_processed integer DEFAULT 0,
    affected_orders_count integer DEFAULT 0,
    failure_reason text
);

CREATE INDEX IF NOT EXISTS reconciliation_runs_status_idx ON reconciliation_runs(status);
CREATE INDEX IF NOT EXISTS reconciliation_runs_is_latest_idx ON reconciliation_runs(is_latest);

-- Add run_id to reconciliations_v0
ALTER TABLE reconciliations_v0
    ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES reconciliation_runs(id);

CREATE INDEX IF NOT EXISTS reconciliations_v0_run_id_idx ON reconciliations_v0(run_id);
CREATE INDEX IF NOT EXISTS reconciliations_v0_order_run_idx ON reconciliations_v0(order_id, run_id);
