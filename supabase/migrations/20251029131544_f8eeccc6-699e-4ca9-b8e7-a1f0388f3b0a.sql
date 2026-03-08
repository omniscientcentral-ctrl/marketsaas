-- Extender tabla cash_register para cierre inteligente
ALTER TABLE public.cash_register
ADD COLUMN IF NOT EXISTS cash_denominations jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS card_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_sales_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_withdrawals numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_expenses numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ticket_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS difference_reason text,
ADD COLUMN IF NOT EXISTS requires_supervisor_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS supervisor_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS closure_type text DEFAULT 'X', -- 'X' o 'Z'
ADD COLUMN IF NOT EXISTS pdf_url text;

-- Crear tabla para historial de egresos/gastos del turno
CREATE TABLE IF NOT EXISTS public.cash_register_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid REFERENCES public.cash_register(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  category text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- RLS para cash_register_expenses
ALTER TABLE public.cash_register_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cajero and above can view expenses"
ON public.cash_register_expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Cajero and above can create expenses"
ON public.cash_register_expenses
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_cash_register_status ON public.cash_register(status);
CREATE INDEX IF NOT EXISTS idx_cash_register_cashier ON public.cash_register(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_dates ON public.cash_register(opened_at, closed_at);
CREATE INDEX IF NOT EXISTS idx_cash_register_expenses_register ON public.cash_register_expenses(cash_register_id);