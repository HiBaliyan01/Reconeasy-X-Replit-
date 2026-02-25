ALTER TABLE rate_card_templates
  ADD COLUMN IF NOT EXISTS header_row_index integer,
  ADD COLUMN IF NOT EXISTS data_start_index integer;
