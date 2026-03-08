-- Eliminar función obsoleta del modelo antiguo
DROP FUNCTION IF EXISTS public.process_sale_stock(uuid, jsonb);

-- Eliminar función obsoleta de inventario del modelo antiguo
DROP FUNCTION IF EXISTS public.mark_product_counted(uuid, integer, text, text);