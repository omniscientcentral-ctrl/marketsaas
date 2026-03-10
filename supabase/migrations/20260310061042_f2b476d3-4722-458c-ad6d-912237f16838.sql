
-- Add super_admin full access policies to ALL operational tables
-- super_admin can bypass empresa_id restrictions

-- Helper: list of tables that need super_admin full access
-- Using individual policy statements for each table

-- 1. products
CREATE POLICY "Super admin full access products" ON public.products FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. customers
CREATE POLICY "Super admin full access customers" ON public.customers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. sales
CREATE POLICY "Super admin full access sales" ON public.sales FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 4. sale_items
CREATE POLICY "Super admin full access sale_items" ON public.sale_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 5. stock_movements
CREATE POLICY "Super admin full access stock_movements" ON public.stock_movements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 6. suppliers
CREATE POLICY "Super admin full access suppliers" ON public.suppliers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 7. cash_registers
CREATE POLICY "Super admin full access cash_registers" ON public.cash_registers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 8. cash_register
CREATE POLICY "Super admin full access cash_register" ON public.cash_register FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 9. cash_register_sessions
CREATE POLICY "Super admin full access cash_register_sessions" ON public.cash_register_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 10. cash_register_expenses
CREATE POLICY "Super admin full access cash_register_expenses" ON public.cash_register_expenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 11. cash_register_audit
CREATE POLICY "Super admin full access cash_register_audit" ON public.cash_register_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 12. cash_register_takeover_audit
CREATE POLICY "Super admin full access cash_register_takeover_audit" ON public.cash_register_takeover_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 13. credits
CREATE POLICY "Super admin full access credits" ON public.credits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 14. credit_payments
CREATE POLICY "Super admin full access credit_payments" ON public.credit_payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 15. expenses
CREATE POLICY "Super admin full access expenses" ON public.expenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 16. pending_sales
CREATE POLICY "Super admin full access pending_sales" ON public.pending_sales FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 17. returns
CREATE POLICY "Super admin full access returns" ON public.returns FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 18. product_batches
CREATE POLICY "Super admin full access product_batches" ON public.product_batches FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 19. product_stock_balance
CREATE POLICY "Super admin full access product_stock_balance" ON public.product_stock_balance FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 20. inventory_counts
CREATE POLICY "Super admin full access inventory_counts" ON public.inventory_counts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 21. notifications
CREATE POLICY "Super admin full access notifications" ON public.notifications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 22. notification_audit
CREATE POLICY "Super admin full access notification_audit" ON public.notification_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 23. price_override_logs
CREATE POLICY "Super admin full access price_override_logs" ON public.price_override_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 24. sale_print_audit
CREATE POLICY "Super admin full access sale_print_audit" ON public.sale_print_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 25. stock_override_audit
CREATE POLICY "Super admin full access stock_override_audit" ON public.stock_override_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 26. supervisor_authorizations
CREATE POLICY "Super admin full access supervisor_authorizations" ON public.supervisor_authorizations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 27. role_assignment_logs
CREATE POLICY "Super admin full access role_assignment_logs" ON public.role_assignment_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 28. company_settings
CREATE POLICY "Super admin full access company_settings" ON public.company_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 29. profiles - super_admin can manage all profiles
CREATE POLICY "Super admin full access profiles" ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 30. user_roles - super_admin can manage all roles
CREATE POLICY "Super admin full access user_roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
