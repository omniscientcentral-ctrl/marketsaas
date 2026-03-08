-- Agregar campo para permitir stock negativo en configuración
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS allow_negative_stock boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.company_settings.allow_negative_stock IS 'Permite ventas con stock 0 o negativo sin autorización de supervisor';