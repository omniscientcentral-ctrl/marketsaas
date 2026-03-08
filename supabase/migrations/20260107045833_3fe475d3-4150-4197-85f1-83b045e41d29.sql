-- Drop existing constraint
ALTER TABLE public.cash_register 
DROP CONSTRAINT IF EXISTS cash_register_status_check;

-- Add updated constraint with pending_approval status
ALTER TABLE public.cash_register 
ADD CONSTRAINT cash_register_status_check 
CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'pending_approval'::text]));