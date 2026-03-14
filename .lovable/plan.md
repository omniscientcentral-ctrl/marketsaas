

## Plan: Fix RLS violation when completing sales in POS

### Root cause

Same pattern as previous fixes. In `src/pages/POS.tsx`, both `completeSale` (line 1379) and `completeSaleForCustomer` (line 1248) insert into the `sales` table without `empresa_id`. The column defaults to "Empresa Inicial", causing RLS violations for other companies.

Additionally, several related inserts in both functions are also missing `empresa_id`:
- `sale_items` inserts (lines 1401, 1271)
- `stock_movements` inserts (lines 1412, 1282)
- `credits` inserts (lines 1450, 1320)

### Fix

**File: `src/pages/POS.tsx`** — The `empresaId` hook is already imported from a previous fix. Add `empresa_id: empresaId` to these 6 insert operations:

1. **`completeSale`** (line 1379): Add `empresa_id: empresaId` to `sales` insert
2. **`completeSale`** (line 1393): Add `empresa_id: empresaId` to each `sale_items` object
3. **`completeSale`** (line 1412): Add `empresa_id: empresaId` to `stock_movements` insert
4. **`completeSale`** (line 1450): Add `empresa_id: empresaId` to `credits` insert
5. **`completeSaleForCustomer`** (line 1248): Add `empresa_id: empresaId` to `sales` insert
6. **`completeSaleForCustomer`** (line 1263): Add `empresa_id: empresaId` to each `sale_items` object
7. **`completeSaleForCustomer`** (line 1282): Add `empresa_id: empresaId` to `stock_movements` insert
8. **`completeSaleForCustomer`** (line 1320): Add `empresa_id: empresaId` to `credits` insert

### Files to modify
1. `src/pages/POS.tsx` — add `empresa_id: empresaId` to 8 insert operations across both sale functions

