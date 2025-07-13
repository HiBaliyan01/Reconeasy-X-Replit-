/*
  # Add new fields to rate_cards table
  
  1. Changes
    - Add RTO fee column
    - Add packaging fee column
    - Add fixed fee column
    - Add min/max price columns for price range
    - Add effective date columns for validity period
*/

ALTER TABLE rate_cards
ADD COLUMN rto_fee numeric,
ADD COLUMN packaging_fee numeric,
ADD COLUMN fixed_fee numeric,
ADD COLUMN min_price numeric,
ADD COLUMN max_price numeric,
ADD COLUMN effective_from date,
ADD COLUMN effective_to date;