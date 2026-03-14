

## Plan: Fix RLS violation on `returns` table insert

### Root cause

The `ReturnsAndLossesDialog` inserts into the `returns` table without including `empresa_id`. The RLS policy requires `empresa_id = get_user_empresa_id(auth.uid())`, so the insert defaults to the "Empresa Inicial" UUID and fails for users of other companies.

Same pattern as the previous fixes on `credit_payments` and `company_settings`.

### Fix

**`src/components/pos/ReturnsAndLossesDialog.tsx`** — 3 changes:

1. Import `useEmpresaId`
2. Call `const empresaId = useEmpresaId()` inside the component
3. Add `empresa_id: empresaId` to the `.insert()` calls for:
   - `returns` table (line ~140)
   - `stock_movements` table (line ~170)
   - `cash_register_expenses` table (line ~195)

### Files to modify
1. `src/components/pos/ReturnsAndLossesDialog.tsx`

