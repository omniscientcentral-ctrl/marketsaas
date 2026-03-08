-- Crear tabla para configuración de la empresa
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT 'Mi Empresa',
  address text,
  phone text,
  email text,
  tax_id text,
  currency text NOT NULL DEFAULT '$',
  receipt_footer text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Política: todos pueden leer (para generar tickets)
CREATE POLICY "Everyone can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (true);

-- Política: solo admin puede actualizar
CREATE POLICY "Only admin can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Política: solo admin puede insertar
CREATE POLICY "Only admin can insert company settings"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insertar configuración inicial por defecto
INSERT INTO public.company_settings (company_name, address, phone, currency, receipt_footer)
VALUES (
  'Mi Tienda',
  'Dirección de la tienda',
  '0000-0000000',
  '$',
  'Gracias por su compra'
)
ON CONFLICT DO NOTHING;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();