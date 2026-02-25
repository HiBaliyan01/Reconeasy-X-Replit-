CREATE TABLE IF NOT EXISTS rate_card_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_template_type text NOT NULL,
  rate_card_version text NOT NULL,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT timezone('utc', now()),
  file_name text,
  data jsonb,
  validation_status text,
  issues jsonb
);
