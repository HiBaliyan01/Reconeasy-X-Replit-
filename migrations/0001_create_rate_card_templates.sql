-- Enable pgcrypto for gen_random_uuid if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create rate_card_templates table to store active rate card schemas
CREATE TABLE IF NOT EXISTS rate_card_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL CHECK (template_type IN ('flat','tiered')),
  version text NOT NULL,
  headers_json jsonb NOT NULL,
  sample_data_url text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  created_by text
);

-- Seed initial v3.1 flat & tiered templates with placeholder headers
INSERT INTO rate_card_templates (template_type, version, headers_json, description)
VALUES
  ('flat','v3.1','[]','Flat rate card template v3.1'),
  ('tiered','v3.1','[]','Tiered rate card template v3.1');
