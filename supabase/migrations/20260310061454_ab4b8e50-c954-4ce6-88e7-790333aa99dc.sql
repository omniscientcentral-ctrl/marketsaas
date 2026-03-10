
-- 1. Create helper function to get user's empresa_id
CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- 2. Drop and recreate non-super_admin policies with empresa_id filtering
-- Note: Super admin full access policies remain untouched

-- ===== PRODUCTS =====
DROP POLICY IF EXISTS "Anyone authenticated can view active products" ON public.products;
CREATE POLICY "Anyone authenticated can view active products" ON public.products FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can insert products" ON public.products;
CREATE POLICY "Repositor and above can insert products" ON public.products FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can update products" ON public.products;
CREATE POLICY "Repositor and above can update products" ON public.products FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can delete products" ON public.products;
CREATE POLICY "Admin can delete products" ON public.products FOR DELETE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CUSTOMERS =====
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage customers" ON public.customers;
CREATE POLICY "Admin can manage customers" ON public.customers FOR ALL TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Supervisor can manage customers" ON public.customers;
CREATE POLICY "Supervisor can manage customers" ON public.customers FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Supervisor can update customers" ON public.customers;
CREATE POLICY "Supervisor can update customers" ON public.customers FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== SALES =====
DROP POLICY IF EXISTS "Cajero can view their own sales" ON public.sales;
CREATE POLICY "Cajero can view their own sales" ON public.sales FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = cashier_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert sales" ON public.sales;
CREATE POLICY "Cajero and above can insert sales" ON public.sales FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Supervisor and above can update sales" ON public.sales;
CREATE POLICY "Supervisor and above can update sales" ON public.sales FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== SALE_ITEMS =====
DROP POLICY IF EXISTS "Users can view sale items of accessible sales" ON public.sale_items;
CREATE POLICY "Users can view sale items of accessible sales" ON public.sale_items FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert sale items" ON public.sale_items;
CREATE POLICY "Cajero and above can insert sale items" ON public.sale_items FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin and supervisor can update sale items" ON public.sale_items;
CREATE POLICY "Admin and supervisor can update sale items" ON public.sale_items FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin and supervisor can delete sale items" ON public.sale_items;
CREATE POLICY "Admin and supervisor can delete sale items" ON public.sale_items FOR DELETE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== STOCK_MOVEMENTS =====
DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can view stock movements" ON public.stock_movements FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Staff can insert stock movements" ON public.stock_movements;
CREATE POLICY "Staff can insert stock movements" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== SUPPLIERS =====
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTERS =====
DROP POLICY IF EXISTS "Authenticated users can view cash registers" ON public.cash_registers;
CREATE POLICY "Authenticated users can view cash registers" ON public.cash_registers FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can manage cash registers" ON public.cash_registers;
CREATE POLICY "Admin can manage cash registers" ON public.cash_registers FOR ALL TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTER (sessions legacy) =====
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.cash_register;
CREATE POLICY "Users can view their own sessions" ON public.cash_register FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = cashier_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.cash_register;
CREATE POLICY "Users can insert their own sessions" ON public.cash_register FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.cash_register;
CREATE POLICY "Users can update their own sessions" ON public.cash_register FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = cashier_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTER_SESSIONS =====
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.cash_register_sessions;
CREATE POLICY "Users can view their own sessions" ON public.cash_register_sessions FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = cashier_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.cash_register_sessions;
CREATE POLICY "Users can insert their own sessions" ON public.cash_register_sessions FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.cash_register_sessions;
CREATE POLICY "Users can update their own sessions" ON public.cash_register_sessions FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = cashier_id OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTER_EXPENSES =====
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.cash_register_expenses;
CREATE POLICY "Authenticated users can view expenses" ON public.cash_register_expenses FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert expenses" ON public.cash_register_expenses;
CREATE POLICY "Cajero and above can insert expenses" ON public.cash_register_expenses FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTER_AUDIT =====
DROP POLICY IF EXISTS "Admin and supervisor can view audit" ON public.cash_register_audit;
CREATE POLICY "Admin and supervisor can view audit" ON public.cash_register_audit FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin and supervisor can insert audit" ON public.cash_register_audit;
CREATE POLICY "Admin and supervisor can insert audit" ON public.cash_register_audit FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CASH_REGISTER_TAKEOVER_AUDIT =====
DROP POLICY IF EXISTS "Admin and supervisor can view takeover audit" ON public.cash_register_takeover_audit;
CREATE POLICY "Admin and supervisor can view takeover audit" ON public.cash_register_takeover_audit FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin and supervisor can insert takeover audit" ON public.cash_register_takeover_audit;
CREATE POLICY "Admin and supervisor can insert takeover audit" ON public.cash_register_takeover_audit FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CREDITS =====
DROP POLICY IF EXISTS "Authenticated users can view credits" ON public.credits;
CREATE POLICY "Authenticated users can view credits" ON public.credits FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert credits" ON public.credits;
CREATE POLICY "Cajero and above can insert credits" ON public.credits FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can update credits" ON public.credits;
CREATE POLICY "Cajero and above can update credits" ON public.credits FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== CREDIT_PAYMENTS =====
DROP POLICY IF EXISTS "Authenticated users can view credit payments" ON public.credit_payments;
CREATE POLICY "Authenticated users can view credit payments" ON public.credit_payments FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert credit payments" ON public.credit_payments;
CREATE POLICY "Cajero and above can insert credit payments" ON public.credit_payments FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== EXPENSES =====
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin and supervisor can manage expenses" ON public.expenses;
CREATE POLICY "Admin and supervisor can manage expenses" ON public.expenses FOR ALL TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero can insert expenses" ON public.expenses;
CREATE POLICY "Cajero can insert expenses" ON public.expenses FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== PENDING_SALES =====
DROP POLICY IF EXISTS "Users can view their own pending sales" ON public.pending_sales;
CREATE POLICY "Users can view their own pending sales" ON public.pending_sales FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can insert their own pending sales" ON public.pending_sales;
CREATE POLICY "Users can insert their own pending sales" ON public.pending_sales FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own pending sales" ON public.pending_sales;
CREATE POLICY "Users can update their own pending sales" ON public.pending_sales FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can delete their own pending sales" ON public.pending_sales;
CREATE POLICY "Users can delete their own pending sales" ON public.pending_sales FOR DELETE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND auth.uid() = cashier_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== RETURNS =====
DROP POLICY IF EXISTS "Authenticated users can view returns" ON public.returns;
CREATE POLICY "Authenticated users can view returns" ON public.returns FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert returns" ON public.returns;
CREATE POLICY "Cajero and above can insert returns" ON public.returns FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== PRODUCT_BATCHES =====
DROP POLICY IF EXISTS "Authenticated users can view batches" ON public.product_batches;
CREATE POLICY "Authenticated users can view batches" ON public.product_batches FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can manage batches" ON public.product_batches;
CREATE POLICY "Repositor and above can manage batches" ON public.product_batches FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can update batches" ON public.product_batches;
CREATE POLICY "Repositor and above can update batches" ON public.product_batches FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== PRODUCT_STOCK_BALANCE =====
DROP POLICY IF EXISTS "Authenticated users can view stock balance" ON public.product_stock_balance;
CREATE POLICY "Authenticated users can view stock balance" ON public.product_stock_balance FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can manage stock balance" ON public.product_stock_balance;
CREATE POLICY "Repositor and above can manage stock balance" ON public.product_stock_balance FOR ALL TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== INVENTORY_COUNTS =====
DROP POLICY IF EXISTS "Authenticated users can view inventory counts" ON public.inventory_counts;
CREATE POLICY "Authenticated users can view inventory counts" ON public.inventory_counts FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Repositor and above can insert inventory counts" ON public.inventory_counts;
CREATE POLICY "Repositor and above can insert inventory counts" ON public.inventory_counts FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== NOTIFICATIONS =====
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = user_id OR user_id IS NULL OR has_role(auth.uid(), 'admin'::app_role))) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND (auth.uid() = user_id OR user_id IS NULL OR has_role(auth.uid(), 'admin'::app_role))) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Staff can insert notifications" ON public.notifications;
CREATE POLICY "Staff can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role, 'repositor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== NOTIFICATION_AUDIT =====
DROP POLICY IF EXISTS "Admin can view notification audit" ON public.notification_audit;
CREATE POLICY "Admin can view notification audit" ON public.notification_audit FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can insert notification audit" ON public.notification_audit;
CREATE POLICY "Admin can insert notification audit" ON public.notification_audit FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== PRICE_OVERRIDE_LOGS =====
DROP POLICY IF EXISTS "Authenticated users can view price overrides" ON public.price_override_logs;
CREATE POLICY "Authenticated users can view price overrides" ON public.price_override_logs FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Staff can insert price overrides" ON public.price_override_logs;
CREATE POLICY "Staff can insert price overrides" ON public.price_override_logs FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== SALE_PRINT_AUDIT =====
DROP POLICY IF EXISTS "Authenticated users can view print audit" ON public.sale_print_audit;
CREATE POLICY "Authenticated users can view print audit" ON public.sale_print_audit FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Cajero and above can insert print audit" ON public.sale_print_audit;
CREATE POLICY "Cajero and above can insert print audit" ON public.sale_print_audit FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role, 'cajero'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== STOCK_OVERRIDE_AUDIT =====
DROP POLICY IF EXISTS "Authenticated users can view stock overrides" ON public.stock_override_audit;
CREATE POLICY "Authenticated users can view stock overrides" ON public.stock_override_audit FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Supervisor and above can insert stock overrides" ON public.stock_override_audit;
CREATE POLICY "Supervisor and above can insert stock overrides" ON public.stock_override_audit FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== SUPERVISOR_AUTHORIZATIONS =====
DROP POLICY IF EXISTS "Authenticated users can view authorizations" ON public.supervisor_authorizations;
CREATE POLICY "Authenticated users can view authorizations" ON public.supervisor_authorizations FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Supervisor and above can insert authorizations" ON public.supervisor_authorizations;
CREATE POLICY "Supervisor and above can insert authorizations" ON public.supervisor_authorizations FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== ROLE_ASSIGNMENT_LOGS =====
DROP POLICY IF EXISTS "Admins can view role logs" ON public.role_assignment_logs;
CREATE POLICY "Admins can view role logs" ON public.role_assignment_logs FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert role logs" ON public.role_assignment_logs;
CREATE POLICY "Admins can insert role logs" ON public.role_assignment_logs FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== COMPANY_SETTINGS =====
DROP POLICY IF EXISTS "Anyone authenticated can view company settings" ON public.company_settings;
CREATE POLICY "Anyone authenticated can view company settings" ON public.company_settings FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can insert company settings" ON public.company_settings;
CREATE POLICY "Admin can insert company settings" ON public.company_settings FOR INSERT TO public
WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admin can update company settings" ON public.company_settings;
CREATE POLICY "Admin can update company settings" ON public.company_settings FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== PROFILES (filter by empresa_id, allow own profile) =====
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO public
USING (auth.uid() = id OR (empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO public
USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ===== USER_ROLES (filter by empresa via user's profile) =====
-- user_roles doesn't have empresa_id directly, keep existing + super_admin override already added
