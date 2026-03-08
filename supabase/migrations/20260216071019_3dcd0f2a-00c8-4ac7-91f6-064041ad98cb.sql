ALTER TABLE public.credit_payments
ADD COLUMN payment_group_id uuid DEFAULT gen_random_uuid();