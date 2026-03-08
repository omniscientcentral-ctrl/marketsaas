-- Agregar columna cash_register_session_id a sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS cash_register_session_id uuid;

-- Agregar columna cash_register_session_id a returns
ALTER TABLE public.returns 
ADD COLUMN IF NOT EXISTS cash_register_session_id uuid;