-- Tabla de auditoría para reimpresiones de ventas
CREATE TABLE IF NOT EXISTS public.sale_print_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id),
  print_type TEXT NOT NULL CHECK (print_type IN ('A4', 'ticket')),
  printed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- RLS policies
ALTER TABLE public.sale_print_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cajero and above can insert print audit"
ON public.sale_print_audit
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin and supervisor can view print audit"
ON public.sale_print_audit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Índice para mejorar rendimiento
CREATE INDEX idx_sale_print_audit_sale_id ON public.sale_print_audit(sale_id);
CREATE INDEX idx_sale_print_audit_printed_by ON public.sale_print_audit(printed_by);