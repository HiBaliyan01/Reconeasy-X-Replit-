/*
  # Update rate_cards table with additional fields

  1. New Columns
    - `rto_fee` (double precision) - Fee for return to origin
    - `packaging_fee` (double precision) - Fee for packaging
    - `fixed_fee` (double precision) - Fixed fee per transaction
    - `min_price` (double precision) - Minimum price for rate card applicability
    - `max_price` (double precision) - Maximum price for rate card applicability
*/

-- Add new columns to rate_cards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'rto_fee'
  ) THEN
    ALTER TABLE rate_cards ADD COLUMN rto_fee double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'packaging_fee'
  ) THEN
    ALTER TABLE rate_cards ADD COLUMN packaging_fee double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'fixed_fee'
  ) THEN
    ALTER TABLE rate_cards ADD COLUMN fixed_fee double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'min_price'
  ) THEN
    ALTER TABLE rate_cards ADD COLUMN min_price double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'max_price'
  ) THEN
    ALTER TABLE rate_cards ADD COLUMN max_price double precision;
  END IF;
END $$;