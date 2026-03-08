
-- 1. Corregir stock negativo existente
UPDATE products SET stock = 0 WHERE stock < 0;

-- 2. Resetear stock de productos con stock_disabled
UPDATE products SET stock = 0 WHERE stock_disabled = true AND stock <> 0;

-- 3. Mejorar trigger para usar GREATEST(0)
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
  SET stock = GREATEST(v_total, 0),
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

-- 4. Sincronizar stock existente con lotes
UPDATE products p
SET stock = GREATEST(
  COALESCE(
    (SELECT SUM(pb.quantity)
     FROM product_batches pb
     WHERE pb.product_id = p.id AND pb.status = 'active'),
    p.stock
  ), 0
);

-- 5. Agregar constraint para prevenir stock negativo
ALTER TABLE products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
