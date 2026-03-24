
-- Limpieza de datos de testing para Rincon Natural (empresa_id: 4d05a014-7cde-4732-ade4-72fbeb219255)

-- 2. Borrar items de órdenes de compra desde 2026-03-23
DELETE FROM purchase_order_items
WHERE purchase_order_id IN (
  SELECT id FROM purchase_orders
  WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
  AND created_at >= '2026-03-23 00:00:00'
);

-- 3. Borrar órdenes de compra
DELETE FROM purchase_orders
WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
AND created_at >= '2026-03-23 00:00:00';

-- 4. Borrar gastos del día
DELETE FROM expenses
WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
AND created_at >= '2026-03-23 00:00:00';

-- 5. Borrar movimientos de stock del día
DELETE FROM stock_movements
WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
AND created_at >= '2026-03-23 00:00:00';

-- 6. Borrar lotes del día
DELETE FROM product_batches
WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
AND created_at >= '2026-03-23 00:00:00';

-- 7. Resetear stock de todos los productos a 0
UPDATE products
SET stock = 0
WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255';

-- 8. Resetear product_stock_balance a 0
UPDATE product_stock_balance
SET current_balance = 0,
    last_movement_at = now()
WHERE product_id IN (
  SELECT id FROM products WHERE empresa_id = '4d05a014-7cde-4732-ade4-72fbeb219255'
);
