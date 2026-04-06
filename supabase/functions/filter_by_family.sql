-- Function to get product IDs by family
CREATE OR REPLACE FUNCTION get_product_ids_by_family(p_family_id UUID)
RETURNS SETONLY UUID AS $$
BEGIN
  RETURN QUERY
  SELECT p.id FROM products p
  WHERE p.family_id = p_family_id
  AND p.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if product belongs to family
CREATE OR REPLACE FUNCTION product_in_family(p_product_id UUID, p_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM products
    WHERE id = p_product_id
    AND family_id = p_family_id
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
