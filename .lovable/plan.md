

## Plan: Fix supplier filtering in POS expense dialog

### Problem
In `src/pages/POS.tsx` line 216, suppliers are fetched without filtering by `empresa_id`. The user "lucianatural" (admin of RN) sees suppliers from other companies (Jorge Fer, Omniscient) when opening the "Nuevo Gasto" dialog from POS.

Additionally, the `ExpenseDialog.tsx` inline supplier refresh (line 445-453) also lacks `empresa_id` filtering when fetching a newly created supplier.

### Changes

#### 1. `src/pages/POS.tsx` (line 213-220)
- Add `empresaId` to the supplier fetch query: `.eq("empresa_id", empresaId)`
- Add `empresaId` to the `useEffect` dependency array
- Guard with early return if `empresaId` is null

#### 2. `src/components/expenses/ExpenseDialog.tsx` (line 445-453)
- Add `empresaId` filtering when refreshing suppliers after creating a new one inline
- Accept `empresaId` prop or use `useEmpresaId` hook
- Also ensure the insert in `handleSubmit` includes `empresa_id`

### Files to modify
- `src/pages/POS.tsx`
- `src/components/expenses/ExpenseDialog.tsx`

