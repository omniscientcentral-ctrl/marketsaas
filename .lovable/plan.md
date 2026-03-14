

## Plan: Fix `create_customer_with_initial_debt` to include `empresa_id`

### Root cause

The SECURITY DEFINER function `create_customer_with_initial_debt` inserts into 3 tables (`customers`, `sales`, `credits`) without specifying `empresa_id`. All rows default to the "Empresa Inicial" UUID, making them invisible to users of other companies.

### Fix

1. **Database migration** — Update the function to accept a new `p_empresa_id uuid` parameter and include it in all 3 INSERT statements (customers, sales, credits).

2. **`src/pages/Customers.tsx`** — Pass `empresaId` from the `useEmpresaId()` hook as the `p_empresa_id` argument when calling the RPC function.

### Files to modify
1. Database migration (new SQL file)
2. `src/pages/Customers.tsx` — add `p_empresa_id: empresaId` to the RPC call (~line 315)

