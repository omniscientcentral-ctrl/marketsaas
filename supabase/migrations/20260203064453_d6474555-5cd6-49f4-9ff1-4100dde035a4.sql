-- Agregar columna para umbral de aprobación en cierre de caja
ALTER TABLE public.company_settings
ADD COLUMN cash_closure_approval_threshold NUMERIC DEFAULT 50;

-- Agregar comentario descriptivo
COMMENT ON COLUMN public.company_settings.cash_closure_approval_threshold IS 
'Diferencias mayores a este monto en el cierre de caja requerirán aprobación de supervisor';