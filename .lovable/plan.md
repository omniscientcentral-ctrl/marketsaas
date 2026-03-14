

## Plan: Fix dashboard data isolation for super_admin empresa selection

### Problem

When the super_admin selects a specific empresa (e.g., "RN"), the `loadExpiringProducts` function does not filter by `empresa_id` — it shows expiring products from **all** companies. The view `products_expiring_soon` lacks an `empresa_id` column, making filtering impossible at the view level.

### Fix

Two changes needed:

#### 1. Update the `products_expiring_soon` view to include `empresa_id`

Database migration to recreate the view adding `p.empresa_id` (from the `products` table join):

```sql
CREATE OR REPLACE VIEW public.products_expiring_soon AS
SELECT pb.id AS batch_id,
    pb.product_id,
    p.name AS product_name,
    p.barcode,
    pb.batch_number,
    pb.quantity,
    pb.expiration_date,
    pb.expiration_date - CURRENT_DATE AS days_until_expiry,
    p.empresa_id
FROM product_batches pb
JOIN products p ON pb.product_id = p.id
WHERE pb.status = 'active' AND pb.quantity > 0 
  AND pb.expiration_date IS NOT NULL 
  AND pb.expiration_date <= (CURRENT_DATE + '30 days'::interval)
ORDER BY pb.expiration_date;
```

#### 2. Update `loadExpiringProducts` in `useDashboardData.ts`

Apply the `withEmpresa` filter to the expiring products query, same pattern as all other loaders:

```typescript
const { data } = await withEmpresa(
  supabase
    .from("products_expiring_soon")
    .select("*")
    .gt("quantity", 0)
    .order("days_until_expiry", { ascending: true })
    .limit(20)
);
```

Update the `useCallback` dependency to include `withEmpresa`.

### Files to modify
1. **Database migration** — recreate `products_expiring_soon` view with `empresa_id`
2. **`src/hooks/useDashboardData.ts`** — add `withEmpresa` to `loadExpiringProducts`

