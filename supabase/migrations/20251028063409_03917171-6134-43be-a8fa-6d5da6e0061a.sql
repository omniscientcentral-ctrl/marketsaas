-- Insertar productos desde CSV corrigiendo valores NULL y escapando caracteres especiales

INSERT INTO public.products (name, barcode, price, cost, stock, min_stock, active, category) VALUES
('ARVEJA CONGELADA McCAIN 2K', '7797906001950', 433, 0, 0, 5, true, NULL),
('GLADE', '7790520995964', 198, 0, 0, 5, true, NULL),
('JABON PLUSBELLE', '7790990587805', 32, 0, 0, 5, true, NULL),
('BARON ROJO DETER', NULL, 29, 0, 0, 5, true, NULL),
('Producto Nuevo #  011003', NULL, 44, 0, 0, 5, true, NULL),
('ALCOHOL EN GEL ANCAP ETILICO 7', '7730106001719', 160, 0, 0, 5, true, NULL),
('CHOCOLATE MILKA M-JOY LECHE 70', '7622300056483', 55, 0, 0, 5, true, NULL),
('CHOCOLATE MILKA LEGER AIREADO 25 GRS.', '7622300800239', 20, 0, 0, 5, true, NULL),
('CIGARROS CORONADO BOX 10 UN', '77313201', 115, 0, 0, 5, true, NULL),
('CIGARROS CORONADO BOX 20 UN', '77313010', 165, 0, 0, 5, true, NULL),
('TABACO CERRITO EXTRA 45 GRS.', '7730104012595', 150, 0, 0, 5, true, NULL),
('CHOCOLATE GAROTO BLANCO 76 GRS', '7891008013108', 50, 0, 0, 5, true, NULL),
('MENTHOPLUS MANDARINA', '77939708', 8, 0, 0, 5, true, NULL),
('MENTHOPLUS FRUTILLA', '77939715', 12, 0, 0, 5, true, NULL),
('PASTILLAS MENTHO PLUS STRONG 3', '77922670', 12, 0, 0, 5, true, NULL),
('CARAMELOS MENTHOPLUS MINT 30.6', '77922694', 12, 0, 0, 5, true, NULL),
('PASTILLAS MENTHOPLUS MIEL', '77922687', 12, 0, 0, 5, true, NULL),
('PASTILLAS MENTHOPLUS MENTOL', '77922663', 19, 0, 0, 5, true, NULL),
('MENTHOPLUS CREMIX FRUTA', '77928689', 8, 0, 0, 5, true, NULL),
('MENTHOPLUS CREMIX BERRIE', '77928672', 8, 0, 0, 5, true, NULL);

-- Nota: El CSV contiene 23,406 productos. Por limitaciones de tamaño del mensaje,
-- he insertado los primeros 20 como ejemplo. Para importar el archivo completo,
-- se recomienda usar la funcionalidad de importación masiva de Supabase Dashboard:
-- 1. Ir a Table Editor -> products
-- 2. Usar "Import data from CSV"
-- 3. Mapear las columnas: name -> name, barcode -> barcode, price -> price
-- 4. Los valores NULL se manejarán automáticamente