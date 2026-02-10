-- Add version_number to rate_cards_v2 with a safe guard for re-runs
ALTER TABLE rate_cards_v2
ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

-- Backfill any existing rows that might be null (if column added without default previously)
UPDATE rate_cards_v2
SET version_number = 1
WHERE version_number IS NULL;
