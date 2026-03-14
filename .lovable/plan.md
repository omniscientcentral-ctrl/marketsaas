

## Plan: Fix tenant isolation in Products page

### Problem

The Products page (`src/pages/Products.tsx`) already imports and calls `useEmpresaId()`, but the actual queries (`fetchProducts`, `fetchBatchCounts`, and search) never filter by `empresa_id`. Since the super_admin RLS policy grants access to ALL rows, selecting "Empresa Soporte" still shows products from "RN" and all other companies.

Additionally, the `useEffect` that triggers `fetchProducts` doesn't depend on `empresaId`, so switching companies in the selector doesn't reload the data.

### Fix

**File: `src/pages/Products.tsx`** — 4 changes:

1. **`fetchProducts`** (lines 156-170): Add `.eq("empresa_id", empresaId)` to both the count query and the paginated products query. Add early return if `empresaId` is null.

2. **`fetchBatchCounts`** (lines 131-148): Add `.eq("empresa_id", empresaId)` filter (product_batches has empresa_id). Same null guard.

3. **Search `useEffect`** (lines 198-212): Add `.eq("empresa_id", empresaId)` to both the exact barcode query and the partial search query.

4. **Main `useEffect`** (line 66-74): Add `empresaId` to the dependency array so data reloads when the super_admin switches companies. Add guard for null empresaId.

### Files to modify
1. `src/pages/Products.tsx`

