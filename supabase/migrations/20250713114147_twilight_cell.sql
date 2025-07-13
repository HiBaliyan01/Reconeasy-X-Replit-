/*
  # Add additional fields to rate_cards table
  
  1. New Fields
    - `rto_fee` (numeric) - Return to origin fee
    - `packaging_fee` (numeric) - Packaging fee
    - `fixed_fee` (numeric) - Fixed fee
    - `min_price` (numeric) - Minimum price for rate card applicability
    - `max_price` (numeric) - Maximum price for rate card applicability
    - `effective_from` (date) - Date from which rate card is effective
    - `effective_to` (date) - Date until which rate card is effective
*/

ALTER TABLE rate_cards
ADD COLUMN IF NOT EXISTS rto_fee numeric,
ADD COLUMN IF NOT EXISTS packaging_fee numeric,
ADD COLUMN IF NOT EXISTS fixed_fee numeric,
ADD COLUMN IF NOT EXISTS min_price numeric,
ADD COLUMN IF NOT EXISTS max_price numeric,
ADD COLUMN IF NOT EXISTS effective_from date,
ADD COLUMN IF NOT EXISTS effective_to date;