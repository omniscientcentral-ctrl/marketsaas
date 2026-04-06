-- Create view to easily filter sales by product family
CREATE OR REPLACE VIEW sales_with_families AS
SELECT
  s.id as sale_id,
  s.*,
  p.family_id
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON p.id = si.product_id
WHERE s.status = 'completed';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sales_with_families_family_id ON sales_with_families(family_id);
CREATE INDEX IF NOT EXISTS idx_sales_with_families_empresa_id ON sales_with_families(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sales_with_families_created_at ON sales_with_families(created_at);
