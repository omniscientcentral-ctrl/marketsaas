-- Limpiar todos los productos existentes
DELETE FROM public.products;

-- Resetear la secuencia de IDs si existe
-- (Los productos usan UUID, así que no es necesario resetear secuencias)

-- Nota: Esta migración limpia todos los productos.
-- Para importar los 23,406 productos del CSV, usa el Dashboard de Supabase:
-- 1. Ve a Table Editor -> products
-- 2. Click en "Insert" -> "Import data from CSV"
-- 3. Sube el archivo CSV
-- 4. Mapea las columnas:
--    - name -> name
--    - barcode -> barcode (permitirá NULL automáticamente)
--    - price -> price
-- 5. Los valores por defecto se aplicarán automáticamente:
--    - cost = 0
--    - stock = 0
--    - min_stock = 5
--    - active = true
--    - category = NULL