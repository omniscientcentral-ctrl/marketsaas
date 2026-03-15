
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
