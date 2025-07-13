/*
  # Create settlements table

  1. New Tables
    - `settlements`
      - `id` (uuid, primary key)
      - `expected_amount` (double precision)
      - `paid_amount` (double precision)
      - `fee_breakdown` (jsonb)
      - `reco_status` (text)
      - `delta` (double precision)
      - `created_at` (timestamp with time zone)
  2. Security
    - Enable RLS on `settlements` table
    - Add policies for authenticated users to manage settlements
*/

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expected_amount double precision NOT NULL,
  paid_amount double precision NOT NULL,
  fee_breakdown jsonb,
  reco_status text,
  delta double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read settlements"
  ON settlements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert settlements"
  ON settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update settlements"
  ON settlements
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete settlements"
  ON settlements
  FOR DELETE
  TO authenticated
  USING (true);