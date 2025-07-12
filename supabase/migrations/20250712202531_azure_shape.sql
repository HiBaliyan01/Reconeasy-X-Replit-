/*
  # Add additional fields to rate_cards table
  
  1. New Fields
    - `rto_fee` (double precision) - Return to origin fee
    - `packaging_fee` (double precision) - Packaging fee
    - `fixed_fee` (double precision) - Fixed platform charge
    - `min_price` (double precision) - Minimum price for slab threshold
    - `max_price` (double precision) - Maximum price for slab threshold
    - `effective_from` (date) - Start date for fee plan
    - `effective_to` (date) - End date for fee plan
    - `promo_discount_fee` (double precision) - Fee for promotions/discounts
    - `territory_fee` (double precision) - Territory-specific fee
    - `notes` (text) - Custom notes for internal reference
*/

-- Add new fields to rate_cards table
ALTER TABLE rate_cards 
ADD COLUMN IF NOT EXISTS rto_fee double precision,
ADD COLUMN IF NOT EXISTS packaging_fee double precision,
ADD COLUMN IF NOT EXISTS fixed_fee double precision,
ADD COLUMN IF NOT EXISTS min_price double precision,
ADD COLUMN IF NOT EXISTS max_price double precision,
ADD COLUMN IF NOT EXISTS effective_from date,
ADD COLUMN IF NOT EXISTS effective_to date,
ADD COLUMN IF NOT EXISTS promo_discount_fee double precision,
ADD COLUMN IF NOT EXISTS territory_fee double precision,
ADD COLUMN IF NOT EXISTS notes text;