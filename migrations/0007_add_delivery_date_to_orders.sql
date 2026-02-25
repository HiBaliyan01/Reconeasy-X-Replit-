-- Add delivery_date to orders (nullable)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_date date;
