

## Plan: Fix global unique constraints on customers table for multi-tenant SaaS

### Root cause

The `customers` table has two unique constraints that are scoped globally instead of per-empresa:
- `customers_document_key` — unique on `(document)` globally
- `customers_phone_key` — unique on `(phone)` globally

This means if Company A creates a customer with document "49035931", Company B (or even the same company retrying after a partial failure) cannot create a customer with the same document. In a SaaS model, uniqueness should be `(empresa_id, document)` and `(empresa_id, phone)`.

Additionally, the previous migration created the updated `create_customer_with_initial_debt` function with `p_empresa_id`, but the database still has the **old version without `p_empresa_id`** (visible in the db-functions dump). The old overload may be taking precedence, so the migration may not have applied or there are two overloads conflicting.

### Fix

**Database migration** with 3 changes:

1. Drop the global unique constraints:
   - `customers_document_key`
   - `customers_phone_key`

2. Create new composite unique indexes scoped per empresa:
   - `UNIQUE (empresa_id, document)` — with a partial index excluding NULLs
   - `UNIQUE (empresa_id, phone)` — with a partial index excluding NULLs

3. Drop the old `create_customer_with_initial_debt` overload (11 params, without `p_empresa_id`) so only the updated 12-param version remains.

```sql
-- Drop global unique constraints
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_document_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;

-- Create per-empresa unique indexes (allowing NULLs)
CREATE UNIQUE INDEX customers_empresa_document_key 
ON public.customers (empresa_id, document) 
WHERE document IS NOT NULL;

CREATE UNIQUE INDEX customers_empresa_phone_key 
ON public.customers (empresa_id, phone) 
WHERE document IS NOT NULL;

-- Drop old function overload without p_empresa_id
DROP FUNCTION IF EXISTS public.create_customer_with_initial_debt(text, text, text, text, text, text, numeric, numeric, text, text, uuid);
```

### No frontend changes needed

### Files to modify
1. New database migration file only

