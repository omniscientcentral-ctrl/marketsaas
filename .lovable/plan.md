

## Plan: Fix tenant isolation in Suppliers and Expenses

### Problem

The `suppliers` table has `empresa_id` but:
1. **Insert** (`SupplierDialog.tsx`): No `empresa_id` is sent when creating a supplier, so it defaults to the hardcoded initial empresa UUID
2. **Select** (`SuppliersTab.tsx`): No `.eq("empresa_id", empresaId)` filter, so all suppliers from all companies are shown
3. **ExpensesTab.tsx**: Same issue -- suppliers and expenses fetched without `empresa_id` filter

### Changes

#### 1. `src/components/expenses/SupplierDialog.tsx`
- Accept `empresaId` prop
- Include `empresa_id: empresaId` in the `supplierData` object on insert

#### 2. `src/components/expenses/SuppliersTab.tsx`
- Import `useEmpresaId`
- Filter `fetchSuppliers` query with `.eq("empresa_id", empresaId)`
- Filter expenses count query with `.eq("empresa_id", empresaId)` (already scoped by supplier, but good practice)
- Add `empresaId` to `useEffect` dependency
- Pass `empresaId` to `SupplierDialog`

#### 3. `src/components/expenses/ExpensesTab.tsx`
- Import `useEmpresaId`
- Filter `fetchSuppliers` and `fetchExpenses` queries by `empresa_id`
- Add `empresaId` to `useEffect` dependencies

### Files to modify
- `src/components/expenses/SupplierDialog.tsx`
- `src/components/expenses/SuppliersTab.tsx`
- `src/components/expenses/ExpensesTab.tsx`

