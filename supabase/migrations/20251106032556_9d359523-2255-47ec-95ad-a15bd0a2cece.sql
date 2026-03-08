-- Crear tabla para registrar devoluciones y mermas
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  return_type text NOT NULL CHECK (return_type IN ('merma', 'devolucion')),
  reason text NOT NULL,
  notes text,
  refund_amount numeric DEFAULT 0,
  refund_method text CHECK (refund_method IN ('efectivo', 'tarjeta', 'credito_cliente', 'sin_reintegro')),
  customer_id uuid REFERENCES public.customers(id),
  related_sale_id uuid REFERENCES public.sales(id),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  authorized_by uuid REFERENCES auth.users(id),
  cash_register_session_id uuid REFERENCES public.cash_register_sessions(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Política: Cajero y superior pueden ver sus propias operaciones o todas si son supervisor/admin
CREATE POLICY "Cajero and above can view returns"
ON public.returns
FOR SELECT
TO authenticated
USING (
  performed_by = auth.uid() OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Política: Cajero y superior pueden crear devoluciones/mermas
CREATE POLICY "Cajero and above can create returns"
ON public.returns
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_returns_product_id ON public.returns(product_id);
CREATE INDEX idx_returns_performed_by ON public.returns(performed_by);
CREATE INDEX idx_returns_created_at ON public.returns(created_at DESC);
CREATE INDEX idx_returns_return_type ON public.returns(return_type);

-- Comentarios para documentación
COMMENT ON TABLE public.returns IS 'Registro de devoluciones de clientes y mermas internas';
COMMENT ON COLUMN public.returns.return_type IS 'Tipo: merma (pérdida interna) o devolucion (con posible reintegro al cliente)';
COMMENT ON COLUMN public.returns.refund_method IS 'Método de reintegro: efectivo, tarjeta, credito_cliente (a favor), sin_reintegro';