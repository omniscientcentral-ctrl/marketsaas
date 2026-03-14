
-- Drop global unique constraints
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_document_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;

-- Create per-empresa unique indexes (allowing NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS customers_empresa_document_key 
ON public.customers (empresa_id, document) 
WHERE document IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_empresa_phone_key 
ON public.customers (empresa_id, phone) 
WHERE phone IS NOT NULL;

-- Drop old function overload (11 params, without p_empresa_id)
DROP FUNCTION IF EXISTS public.create_customer_with_initial_debt(text, text, text, text, text, text, numeric, numeric, text, text, uuid);
