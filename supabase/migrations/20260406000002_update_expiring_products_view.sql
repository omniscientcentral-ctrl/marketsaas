-- Add family_id to products_expiring_soon view
CREATE OR REPLACE VIEW products_expiring_soon AS
SELECT
  b.batch_id,
  b.product_id,
  p.name as product_name,
  p.family_id,
  b.batch_number,
  b.quantity,
  b.expiration_date,
  GREATEST(0, DATE_PART('day', b.expiration_date::date - NOW()::date)) as days_until_expiry,
  b.empresa_id
FROM product_batches b
JOIN products p ON p.id = b.product_id
WHERE b.quantity > 0
  AND b.expiration_date IS NOT NULL;

-- Create index for the updated view
CREATE INDEX IF NOT EXISTS idx_products_expiring_soon_family_id ON products_expiring_soon(family_id);
