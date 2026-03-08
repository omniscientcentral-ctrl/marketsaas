-- Crear tabla de lotes de productos
CREATE TABLE public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text,
  quantity numeric NOT NULL DEFAULT 0,
  initial_quantity numeric NOT NULL,
  expiration_date date NOT NULL,
  received_at timestamp with time zone DEFAULT now(),
  cost numeric DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX idx_product_batches_product ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_expiration ON public.product_batches(expiration_date);
CREATE INDEX idx_product_batches_status ON public.product_batches(status);

-- Habilitar RLS
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

-- Repositor y superiores pueden ver lotes
CREATE POLICY "Repositor and above can view batches"
ON public.product_batches
FOR SELECT
USING (
  has_role(auth.uid(), 'repositor'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Repositor y superiores pueden crear lotes
CREATE POLICY "Repositor and above can create batches"
ON public.product_batches
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'repositor'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Repositor y superiores pueden actualizar lotes
CREATE POLICY "Repositor and above can update batches"
ON public.product_batches
FOR UPDATE
USING (
  has_role(auth.uid(), 'repositor'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_product_batches_updated_at
BEFORE UPDATE ON public.product_batches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Vista para productos próximos a vencer
CREATE VIEW public.products_expiring_soon AS
SELECT 
  pb.*,
  p.name as product_name,
  p.barcode,
  (pb.expiration_date - CURRENT_DATE) as days_until_expiration
FROM public.product_batches pb
JOIN public.products p ON p.id = pb.product_id
WHERE pb.status = 'active' 
  AND pb.quantity > 0
  AND pb.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY pb.expiration_date ASC;