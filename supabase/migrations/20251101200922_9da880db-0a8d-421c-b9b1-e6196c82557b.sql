-- Renombrar allow_negative_stock a stock_disabled con lógica invertida en products
ALTER TABLE public.products 
  RENAME COLUMN allow_negative_stock TO stock_disabled;

-- Invertir valores existentes: true -> false, false -> true
UPDATE public.products 
  SET stock_disabled = NOT stock_disabled;

-- Renombrar allow_negative_stock a stock_disabled en company_settings
ALTER TABLE public.company_settings 
  RENAME COLUMN allow_negative_stock TO stock_disabled;

-- NO invertir valores en company_settings (mantener consistencia global)
-- Si estaba en false (no permitir negativo), ahora false (stock activado, control normal)
-- Si estaba en true (permitir negativo), ahora true (stock desactivado, sin control)