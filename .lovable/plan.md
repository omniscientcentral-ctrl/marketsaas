

## Plan: Fix RLS violation when saving pending sales

### Root cause

In `src/pages/POS.tsx`, the `savePendingSale` function (line 673) inserts into `pending_sales` without including `empresa_id`. The column defaults to the "Empresa Inicial" UUID, but RLS requires `empresa_id = get_user_empresa_id(auth.uid())`. For users of other companies, this causes the violation.

### Fix

**File: `src/pages/POS.tsx`**

1. Import `useEmpresaId` from `@/hooks/useEmpresaId`
2. Call the hook: `const empresaId = useEmpresaId()`
3. Add `empresa_id: empresaId` to the `pending_sales` insert object (line 674)

One-line addition to the insert, same pattern applied to products and cash registers previously.

### Files to modify
1. `src/pages/POS.tsx`

