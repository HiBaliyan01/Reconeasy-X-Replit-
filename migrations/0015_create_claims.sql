BEGIN;

CREATE TABLE IF NOT EXISTS claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    marketplace text NOT NULL,
    order_id text NOT NULL,
    bucket text NOT NULL,
    claim_amount numeric NOT NULL,
    expected_amount numeric NOT NULL,
    actual_amount numeric NOT NULL,
    discrepancy_amount numeric NOT NULL,
    claim_status text NOT NULL DEFAULT 'DRAFT',
    reconciliation_run_id uuid NOT NULL,
    reconciliation_component_id uuid,
    uploaded_file_id uuid,
    marketplace_ticket_id text,
    claim_reason text,
    evidence_snapshot jsonb,
    created_by text,
    submitted_at timestamptz,
    recovered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT claims_status_check CHECK (
        claim_status IN (
            'DRAFT',
            'SUBMITTED',
            'ACKNOWLEDGED',
            'IN_REVIEW',
            'APPROVED',
            'REJECTED',
            'RECOVERED'
        )
    )
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reconciliation_runs'
          AND column_name = 'id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'claims_reconciliation_run_fk'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_reconciliation_run_fk
            FOREIGN KEY (reconciliation_run_id)
            REFERENCES reconciliation_runs(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reconciliation_fee_components'
          AND column_name = 'id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'claims_reconciliation_component_fk'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_reconciliation_component_fk
            FOREIGN KEY (reconciliation_component_id)
            REFERENCES reconciliation_fee_components(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'uploaded_files'
          AND column_name = 'id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'claims_uploaded_file_fk'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_uploaded_file_fk
            FOREIGN KEY (uploaded_file_id)
            REFERENCES uploaded_files(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'claims_unique_order_bucket_run'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_unique_order_bucket_run
            UNIQUE (tenant_id, order_id, bucket, reconciliation_run_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claims_tenant_marketplace_status
    ON claims (tenant_id, marketplace, claim_status);

CREATE INDEX IF NOT EXISTS idx_claims_order_id
    ON claims (order_id);

CREATE INDEX IF NOT EXISTS idx_claims_run_id
    ON claims (reconciliation_run_id);

CREATE INDEX IF NOT EXISTS idx_claims_component_id
    ON claims (reconciliation_component_id);

CREATE INDEX IF NOT EXISTS idx_claims_uploaded_file_id
    ON claims (uploaded_file_id);

CREATE INDEX IF NOT EXISTS idx_claims_created_at
    ON claims (created_at DESC);

CREATE OR REPLACE FUNCTION set_claims_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claims_updated_at ON claims;

CREATE TRIGGER trg_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION set_claims_updated_at();

COMMIT;
