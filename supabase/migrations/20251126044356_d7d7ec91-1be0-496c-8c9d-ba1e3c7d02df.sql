-- Cambiar quantity de integer a numeric en sale_items para soportar productos pesables
ALTER TABLE public.sale_items 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Cambiar quantity de integer a numeric en stock_movements
ALTER TABLE public.stock_movements 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Cambiar previous_stock y new_stock de integer a numeric en stock_movements
ALTER TABLE public.stock_movements 
  ALTER COLUMN previous_stock TYPE numeric USING previous_stock::numeric,
  ALTER COLUMN new_stock TYPE numeric USING new_stock::numeric;

-- Cambiar quantity de integer a numeric en supervisor_authorizations
ALTER TABLE public.supervisor_authorizations 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Cambiar quantity de integer a numeric en returns
ALTER TABLE public.returns 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Cambiar stock_before y stock_after de integer a numeric en stock_override_audit
ALTER TABLE public.stock_override_audit 
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric,
  ALTER COLUMN stock_before TYPE numeric USING stock_before::numeric,
  ALTER COLUMN stock_after TYPE numeric USING stock_after::numeric;

-- Comentarios para documentar el cambio
COMMENT ON COLUMN public.sale_items.quantity IS 'Cantidad del producto en la venta (acepta decimales para productos pesables)';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Cantidad del movimiento de stock (acepta decimales)';
COMMENT ON COLUMN public.returns.quantity IS 'Cantidad del producto devuelto (acepta decimales)';