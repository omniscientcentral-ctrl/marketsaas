-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'inactive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for document and phone to prevent duplicates
CREATE UNIQUE INDEX idx_customers_document ON public.customers(document) WHERE document IS NOT NULL;
CREATE UNIQUE INDEX idx_customers_phone ON public.customers(phone) WHERE phone IS NOT NULL;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Admin can manage all customers"
  ON public.customers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cajero can view customers"
  ON public.customers
  FOR SELECT
  USING (
    has_role(auth.uid(), 'cajero'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Add customer_id to credits table
ALTER TABLE public.credits ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add customer_id to credit_payments table
ALTER TABLE public.credit_payments ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;

-- Add customer_id to sales table
ALTER TABLE public.sales ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_customers_status ON public.customers(status);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_credits_customer_id ON public.credits(customer_id);
CREATE INDEX idx_credit_payments_customer_id ON public.credit_payments(customer_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);