ALTER TABLE rate_card_data
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS record_count integer;

ALTER TABLE rate_cards_v2
  ADD COLUMN IF NOT EXISTS template_type text,
  ADD COLUMN IF NOT EXISTS template_version text,
  ADD COLUMN IF NOT EXISTS uploaded_by text,
  ADD COLUMN IF NOT EXISTS source_upload_id uuid,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;
