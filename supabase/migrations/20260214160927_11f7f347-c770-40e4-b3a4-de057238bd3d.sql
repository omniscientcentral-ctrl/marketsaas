
-- 1. Trigger: sync stock from batches
CREATE OR REPLACE FUNCTION public.sync_stock_from_batches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
  v_product_id uuid;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_total
  FROM product_batches
  WHERE product_id = v_product_id
    AND status = 'active';

  UPDATE products
  SET stock = v_total,
      stock_disabled = CASE
        WHEN v_total > 0 OR EXISTS (
          SELECT 1 FROM product_batches
          WHERE product_id = v_product_id AND status = 'active'
        ) THEN false
        ELSE stock_disabled
      END
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_stock_from_batches
AFTER INSERT OR UPDATE OR DELETE ON product_batches
FOR EACH ROW
EXECUTE FUNCTION public.sync_stock_from_batches();

-- 2. Sync existing stock data
UPDATE products p
SET stock = COALESCE(
  (SELECT SUM(pb.quantity)
   FROM product_batches pb
   WHERE pb.product_id = p.id AND pb.status = 'active'),
  p.stock
);
