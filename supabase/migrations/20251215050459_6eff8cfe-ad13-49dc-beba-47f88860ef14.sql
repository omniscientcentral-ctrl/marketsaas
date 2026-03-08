-- Eliminar FK existente que referencia cash_register_sessions
ALTER TABLE public.sales 
DROP CONSTRAINT IF EXISTS sales_cash_register_session_id_fkey;

-- Crear nuevo FK que referencia cash_register (donde están las sesiones activas)
ALTER TABLE public.sales 
ADD CONSTRAINT sales_cash_register_session_id_fkey 
FOREIGN KEY (cash_register_session_id) 
REFERENCES public.cash_register(id);