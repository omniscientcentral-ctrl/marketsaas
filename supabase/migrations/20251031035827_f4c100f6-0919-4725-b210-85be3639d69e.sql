-- Agregar campo allow_negative_stock a productos
ALTER TABLE public.products
ADD COLUMN allow_negative_stock boolean NOT NULL DEFAULT false;

-- Mejorar stock_movements con campos de auditoría
ALTER TABLE public.stock_movements
ADD COLUMN previous_stock integer,
ADD COLUMN new_stock integer,
ADD COLUMN reason text;

-- Crear índice único para sesión abierta por caja (solo una sesión 'open' por caja)
CREATE UNIQUE INDEX idx_one_open_session_per_register 
ON public.cash_register (cash_register_id) 
WHERE status = 'open';

-- Agregar tabla para log de autorizaciones supervisor
CREATE TABLE public.supervisor_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id),
  product_id uuid REFERENCES public.products(id) NOT NULL,
  authorized_by uuid REFERENCES public.profiles(id) NOT NULL,
  reason text NOT NULL,
  quantity integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para supervisor_authorizations
ALTER TABLE public.supervisor_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cajero and above can view authorizations"
ON public.supervisor_authorizations
FOR SELECT
USING (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert authorizations"
ON public.supervisor_authorizations
FOR INSERT
WITH CHECK (true);

-- Crear comentarios para documentación
COMMENT ON COLUMN public.products.allow_negative_stock IS 'Permite que el producto tenga stock negativo al vender';
COMMENT ON COLUMN public.stock_movements.previous_stock IS 'Stock antes del movimiento';
COMMENT ON COLUMN public.stock_movements.new_stock IS 'Stock después del movimiento';
COMMENT ON COLUMN public.stock_movements.reason IS 'Razón detallada del movimiento (venta, autorización, cambio de política, etc.)';
COMMENT ON TABLE public.supervisor_authorizations IS 'Log de autorizaciones de supervisor para ventas sin stock';