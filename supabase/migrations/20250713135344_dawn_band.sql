/*
  # Create alerts table

  1. New Tables
    - `alerts`
      - `id` (uuid, primary key)
      - `type` (text)
      - `message` (text)
      - `created_at` (timestamp with time zone)
  2. Security
    - Enable RLS on `alerts` table
    - Add policies for authenticated users to read, insert, update, and delete alerts
*/

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert alerts"
  ON alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update alerts"
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete alerts"
  ON alerts
  FOR DELETE
  TO authenticated
  USING (true);