-- Eliminar el constraint de unicidad en barcode
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_barcode_unique_not_null;

-- Eliminar cualquier otro constraint único en barcode
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_barcode_key;

ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_barcode_unique;

-- Crear un índice no único para mejorar búsquedas por barcode
CREATE INDEX IF NOT EXISTS idx_products_barcode 
ON public.products(barcode) 
WHERE barcode IS NOT NULL;

-- Ahora los productos pueden tener códigos duplicados y múltiples NULL