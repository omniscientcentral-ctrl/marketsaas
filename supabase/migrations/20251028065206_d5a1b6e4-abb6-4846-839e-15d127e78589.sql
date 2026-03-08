-- Ajustar tipos de datos numéricos para evitar overflow
-- Cambiar numeric sin límites explícitos a numeric con mayor precisión

ALTER TABLE public.products 
ALTER COLUMN price TYPE numeric(12,2);

ALTER TABLE public.products 
ALTER COLUMN cost TYPE numeric(12,2);

-- Stock puede ser un número muy grande, usar bigint
ALTER TABLE public.products 
ALTER COLUMN stock TYPE integer;

ALTER TABLE public.products 
ALTER COLUMN min_stock TYPE integer;

-- Nota: numeric(12,2) permite valores hasta 9,999,999,999.99
-- Si hay valores más grandes en el CSV, aumentar el primer número