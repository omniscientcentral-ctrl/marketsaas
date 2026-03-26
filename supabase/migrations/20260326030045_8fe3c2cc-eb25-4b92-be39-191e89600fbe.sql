
-- Función para calcular costo promedio ponderado desde lotes activos
CREATE OR REPLACE FUNCTION public.update_product_cost_from_batches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  v_weighted_cost numeric;
  v_total_qty numeric;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  SELECT SUM(quantity),
         SUM(quantity * cost)
  INTO v_total_qty, v_weighted_cost
  FROM product_batches
  WHERE product_id = v_product_id
    AND status = 'active'
    AND quantity > 0
    AND cost IS NOT NULL
    AND cost > 0;

  IF v_total_qty IS NOT NULL AND v_total_qty > 0 THEN
    UPDATE products
    SET cost = ROUND(v_weighted_cost / v_total_qty, 2)
    WHERE id = v_product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger AFTER en product_batches
CREATE TRIGGER trg_update_product_cost
  AFTER INSERT OR UPDATE OR DELETE
  ON product_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_product_cost_from_batches();
