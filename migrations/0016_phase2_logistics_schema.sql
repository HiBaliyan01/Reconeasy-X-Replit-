BEGIN;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  internal_sku TEXT NOT NULL,
  product_name TEXT,
  category TEXT,
  weight_grams INTEGER,
  cogs NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, internal_sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant_sku
ON products(tenant_id, internal_sku);

CREATE TABLE IF NOT EXISTS rate_card_logistics_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL
    REFERENCES rate_cards_v2(id)
    ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  weight_min_grams INTEGER NOT NULL,
  weight_max_grams INTEGER NOT NULL,
  zone TEXT NOT NULL DEFAULT 'national'
    CHECK (zone IN ('local', 'regional', 'national')),
  service_level TEXT DEFAULT 'standard',
  forward_fee NUMERIC NOT NULL,
  reverse_fee NUMERIC,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rate_card_id, weight_min_grams, weight_max_grams, zone, service_level)
);

CREATE INDEX IF NOT EXISTS idx_logistics_slabs_lookup
ON rate_card_logistics_slabs(
  rate_card_id,
  zone,
  weight_min_grams,
  weight_max_grams
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

CREATE OR REPLACE FUNCTION set_products_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_products_updated_at();

-- Seed one product for default tenant
INSERT INTO products (tenant_id, internal_sku, product_name, category, weight_grams, cogs)
VALUES ('1935f074-7acd-4799-8090-1f8cb085d1a4', 'SKU001', 'Test Product', 'apparel', 450, 299)
ON CONFLICT (tenant_id, internal_sku) DO UPDATE
SET
  product_name = EXCLUDED.product_name,
  category = EXCLUDED.category,
  weight_grams = EXCLUDED.weight_grams,
  cogs = EXCLUDED.cogs;

-- Seed Amazon logistics slabs using existing rate card
-- rate_card_id: 3fa06139-588e-4a9c-947e-1b0bacd15cf2
INSERT INTO rate_card_logistics_slabs 
  (rate_card_id, marketplace, weight_min_grams, weight_max_grams, zone, forward_fee, reverse_fee, effective_from)
VALUES
  ('3fa06139-588e-4a9c-947e-1b0bacd15cf2', 'amazon', 0, 500, 'national', 48, 65, '2025-04-01'),
  ('3fa06139-588e-4a9c-947e-1b0bacd15cf2', 'amazon', 501, 1000, 'national', 72, 95, '2025-04-01'),
  ('3fa06139-588e-4a9c-947e-1b0bacd15cf2', 'amazon', 1001, 2000, 'national', 96, 120, '2025-04-01'),
  ('3fa06139-588e-4a9c-947e-1b0bacd15cf2', 'amazon', 2001, 5000, 'national', 130, 160, '2025-04-01')
ON CONFLICT (rate_card_id, weight_min_grams, weight_max_grams, zone, service_level) DO UPDATE
SET
  marketplace = EXCLUDED.marketplace,
  forward_fee = EXCLUDED.forward_fee,
  reverse_fee = EXCLUDED.reverse_fee,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to;

-- Update ORDER001 with weight matching SKU001
UPDATE orders 
SET weight_grams = 450
WHERE order_id = 'ORDER001';

COMMIT;
