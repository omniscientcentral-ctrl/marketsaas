-- Actualizar todos los productos existentes para tener stock desactivado por defecto
UPDATE public.products SET stock_disabled = true WHERE stock_disabled = false;

-- Cambiar el valor por defecto de la columna stock_disabled a true
ALTER TABLE public.products ALTER COLUMN stock_disabled SET DEFAULT true;