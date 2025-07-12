/*
  # Add additional fields to rate_cards table

  1. New Columns
    - `rto_fee` (double precision) - Return-to-Origin fee
    - `packaging_fee` (double precision) - Packaging/environmental charge
    - `fixed_fee` (double precision) - Any fixed platform fee
    - `min_price` (double precision) - Slab minimum price
    - `max_price` (double precision) - Slab maximum price
*/

-- Add new columns to rate_cards table
ALTER TABLE rate_cards
  ADD COLUMN IF NOT EXISTS rto_fee double precision,
  ADD COLUMN IF NOT EXISTS packaging_fee double precision,
  ADD COLUMN IF NOT EXISTS fixed_fee double precision,
  ADD COLUMN IF NOT EXISTS min_price double precision,
  ADD COLUMN IF NOT EXISTS max_price double precision;