-- Eliminar productos duplicados manteniendo solo uno de cada barcode
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY barcode, name ORDER BY created_at) as rn
  FROM products
  WHERE barcode IS NOT NULL
)
DELETE FROM products
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Crear índice para mejorar búsqueda por barcode
CREATE INDEX IF NOT EXISTS idx_products_barcode_search 
ON public.products(barcode text_pattern_ops) 
WHERE barcode IS NOT NULL;