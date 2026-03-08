-- Add print_type column to cash_register table
ALTER TABLE public.cash_register 
ADD COLUMN print_type TEXT CHECK (print_type IN ('a4', 'tickeadora', 'no_imprimir')) DEFAULT 'no_imprimir';