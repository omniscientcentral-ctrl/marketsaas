-- Eliminar política actual de expenses
DROP POLICY IF EXISTS "admin_manage_expenses" ON public.expenses;

-- Admin y Supervisor: acceso total a expenses
CREATE POLICY "admin_supervisor_manage_expenses" ON public.expenses
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Cajero: solo lectura de expenses
CREATE POLICY "cajero_view_expenses" ON public.expenses
  FOR SELECT 
  USING (has_role(auth.uid(), 'cajero'::app_role));

-- Cajero: puede crear gastos
CREATE POLICY "cajero_insert_expenses" ON public.expenses
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'cajero'::app_role));

-- Agregar lectura de suppliers para supervisor y cajero
CREATE POLICY "staff_view_suppliers" ON public.suppliers
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'cajero'::app_role)
  );