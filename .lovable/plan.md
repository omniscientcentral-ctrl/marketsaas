

## Plan: Fix RLS violation when creating products

### Root cause

In `src/pages/Products.tsx`, the product insert (line 361-369) does not include `empresa_id`. The column defaults to the "Empresa Inicial" UUID, but RLS requires `empresa_id = get_user_empresa_id(auth.uid())`. For users of other companies, this mismatch causes the RLS violation.

Same issue affects the `product_stock_balance` insert (line 380) and `stock_movements` inserts (lines 324, 787).

### Fix

**File: `src/pages/Products.tsx`**

1. Import `useEmpresaId` hook
2. Add `empresa_id: empresaId` to the product insert object (line 368)
3. Add `empresa_id: empresaId` to the `product_stock_balance` insert (line 380)
4. Add `empresa_id: empresaId` to both `stock_movements` inserts (lines 324, 787)

### Files to modify
1. `src/pages/Products.tsx` — add `useEmpresaId` import and include `empresa_id` in all insert operations

