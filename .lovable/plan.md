

## Plan: Fix RLS violation on credit_payments insert

### Root cause

The `DebtPaymentModal` inserts into `credit_payments` without including `empresa_id`. The RLS policy requires `empresa_id = get_user_empresa_id(auth.uid())`, so if the user belongs to a different empresa than the default, the insert is rejected.

### Fix

**`src/components/pos/DebtPaymentModal.tsx`** — Import `useEmpresaId` and add `empresa_id` to the `credit_payments` insert (line ~198).

1. Add `import { useEmpresaId } from "@/hooks/useEmpresaId"` 
2. Call `const empresaId = useEmpresaId()` inside the component
3. Add `empresa_id: empresaId` to the `.insert()` call for `credit_payments`

No database changes needed — the table and RLS are correct; the frontend just isn't sending the required field.

