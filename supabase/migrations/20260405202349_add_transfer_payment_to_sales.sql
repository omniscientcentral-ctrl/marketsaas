-- Add transferencia bancaria as payment method to sales table
-- Timestamp: 20260405202349

-- 1. Add transfer_amount column to sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(10,2) DEFAULT 0;

-- 2. Update payment_method constraint to include 'transfer'
ALTER TABLE public.sales
DROP CONSTRAINT IF EXISTS sales_payment_method_check,
ADD CONSTRAINT sales_payment_method_check
CHECK (payment_method = ANY (ARRAY['cash', 'card', 'mixed', 'credit', 'transfer']));
