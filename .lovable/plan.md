

## Plan: Fix suppliers RLS policies missing `empresa_id` filtering

### Root Cause

The `suppliers` table has an old RLS policy **"Admin can manage suppliers"** that grants `FOR ALL` access with only `has_role(auth.uid(), 'admin')` — no `empresa_id` check. Since RLS policies are **permissive** (OR logic), this policy lets any admin see ALL suppliers across all companies, overriding the correctly filtered "Authenticated users can view suppliers" policy.

Same issue with "Supervisor can insert/update suppliers" — no tenant isolation.

### Fix (1 database migration)

Drop the 3 old policies and recreate them with `empresa_id` filtering:

```sql
-- Drop old unscoped policies
DROP POLICY IF EXISTS "Admin can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Supervisor can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Supervisor can update suppliers" ON public.suppliers;

-- Recreate with empresa_id isolation
CREATE POLICY "Admin can manage suppliers" ON public.suppliers FOR ALL
USING (
  (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Supervisor can insert suppliers" ON public.suppliers FOR INSERT
WITH CHECK (
  (empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Supervisor can update suppliers" ON public.suppliers FOR UPDATE
USING (
  (empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
```

No frontend code changes needed — the existing `empresa_id` filter in POS.tsx is a good defense-in-depth measure, but the real fix is at the RLS level.

### Files to modify
- 1 new database migration (RLS policy update)

