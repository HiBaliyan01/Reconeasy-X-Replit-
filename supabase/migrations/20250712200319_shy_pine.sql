/*
  # Create rate_cards table

  1. New Tables
    - `rate_cards`
      - `id` (uuid, primary key)
      - `platform` (text, not null)
      - `category` (text, not null)
      - `commission_rate` (float)
      - `shipping_fee` (float)
      - `gst_rate` (float)
      - `created_at` (timestamptz, default now())
  2. Security
    - Enable RLS on `rate_cards` table
    - Add policy for authenticated users to read and write their own data
*/

create table if not exists rate_cards (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  category text not null,
  commission_rate float,
  shipping_fee float,
  gst_rate float,
  created_at timestamptz default now()
);

alter table rate_cards enable row level security;

create policy "Users can read rate_cards"
  on rate_cards
  for select
  to authenticated
  using (true);

create policy "Users can insert rate_cards"
  on rate_cards
  for insert
  to authenticated
  with check (true);

create policy "Users can update rate_cards"
  on rate_cards
  for update
  to authenticated
  using (true);

create policy "Users can delete rate_cards"
  on rate_cards
  for delete
  to authenticated
  using (true);