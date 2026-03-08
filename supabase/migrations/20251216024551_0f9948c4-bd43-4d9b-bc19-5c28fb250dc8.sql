-- Tabla de proveedores
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de gastos
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pendiente',
  invoice_number TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  receipt_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS: Solo admin puede gestionar proveedores
CREATE POLICY "admin_manage_suppliers" ON public.suppliers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Solo admin puede gestionar gastos
CREATE POLICY "admin_manage_expenses" ON public.expenses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Índices
CREATE INDEX idx_expenses_supplier_id ON public.expenses(supplier_id);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX idx_expenses_payment_status ON public.expenses(payment_status);

-- Trigger para updated_at en suppliers
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger para updated_at en expenses
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Bucket de storage para comprobantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true);

-- Policy para que admin pueda gestionar comprobantes
CREATE POLICY "Admin can manage expense receipts"
ON storage.objects FOR ALL
USING (bucket_id = 'expense-receipts' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'expense-receipts' AND has_role(auth.uid(), 'admin'::app_role));