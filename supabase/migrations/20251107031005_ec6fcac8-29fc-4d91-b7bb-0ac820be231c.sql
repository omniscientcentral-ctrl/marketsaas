-- Agregar campo can_edit_price a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_edit_price boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS price_edit_unlocked_at timestamp with time zone;

-- Crear tabla de auditoría de cambios de precio
CREATE TABLE IF NOT EXISTS public.price_override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  original_price numeric NOT NULL,
  new_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS en price_override_logs
ALTER TABLE public.price_override_logs ENABLE ROW LEVEL SECURITY;

-- Policy para que cajeros y superiores puedan ver sus propios registros
CREATE POLICY "Users can view their own price changes"
ON public.price_override_logs
FOR SELECT
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Policy para insertar registros de cambios de precio
CREATE POLICY "Cajero and above can create price override logs"
ON public.price_override_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Comentarios para documentación
COMMENT ON COLUMN public.profiles.can_edit_price IS 'Permiso para editar precios desde POS';
COMMENT ON COLUMN public.profiles.price_edit_unlocked_at IS 'Fecha del último cambio de permiso de edición de precios';
COMMENT ON TABLE public.price_override_logs IS 'Auditoría de cambios de precio realizados en POS';