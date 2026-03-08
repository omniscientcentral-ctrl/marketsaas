-- Agregar columna para umbral de aprobación de diferencia en cierre de caja
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS cash_closure_approval_threshold numeric NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.company_settings.cash_closure_approval_threshold IS 'Monto máximo de diferencia permitida en cierre de caja antes de requerir aprobación de supervisor';