CREATE TABLE IF NOT EXISTS claim_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id),
  batch_name TEXT NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_discrepancy NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'CLOSED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_batches_tenant
ON claim_batches(tenant_id, marketplace);

ALTER TABLE claims
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES claim_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS group_key TEXT,
ADD COLUMN IF NOT EXISTS zone TEXT;

CREATE INDEX IF NOT EXISTS idx_claims_batch_id ON claims(batch_id);
CREATE INDEX IF NOT EXISTS idx_claims_group_key ON claims(group_key);
