
-- =============================================
-- FASE 1: TIPOS Y FUNCIONES BASE
-- =============================================

-- 1.1 Crear enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'cajero', 'repositor');

-- 1.2 Función update_updated_at para triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================
-- FASE 2: TABLAS DE USUARIOS Y SEGURIDAD
-- =============================================

-- 2.1 Tabla profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  pin TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  default_role public.app_role DEFAULT 'cajero',
  can_edit_price BOOLEAN DEFAULT FALSE,
  price_edit_unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2.2 Tabla user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2.3 Función has_role (SECURITY DEFINER para evitar recursión)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2.4 Función para verificar múltiples roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- 2.5 Tabla role_assignment_logs
CREATE TABLE public.role_assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'revoked')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.role_assignment_logs ENABLE ROW LEVEL SECURITY;

-- 2.6 Función handle_new_user para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Trigger para crear perfil en nuevo usuario
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies para profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para role_assignment_logs
CREATE POLICY "Admins can view role logs"
  ON public.role_assignment_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert role logs"
  ON public.role_assignment_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at para profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 3: TABLAS DE PRODUCTOS E INVENTARIO
-- =============================================

-- 3.1 Tabla products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  category TEXT,
  active BOOLEAN DEFAULT TRUE,
  stock_disabled BOOLEAN DEFAULT FALSE,
  allow_negative_stock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_products_active ON public.products(active);

-- 3.2 Tabla product_stock_balance
CREATE TABLE public.product_stock_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_balance INTEGER NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_stock_balance ENABLE ROW LEVEL SECURITY;

-- 3.3 Tabla product_batches
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  batch_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  initial_quantity INTEGER NOT NULL DEFAULT 0,
  expiration_date DATE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  cost NUMERIC(10,2),
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'depleted')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_product_batches_product_id ON public.product_batches(product_id);
CREATE INDEX idx_product_batches_expiration ON public.product_batches(expiration_date);

-- 3.4 Tabla stock_movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return', 'loss', 'transfer', 'initial')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  previous_stock INTEGER,
  new_stock INTEGER,
  reason TEXT,
  authorized_by UUID REFERENCES auth.users(id),
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at);

-- 3.5 Tabla inventory_counts
CREATE TABLE public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  qty_counted INTEGER NOT NULL,
  counted_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual',
  notes TEXT,
  counted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies para products
CREATE POLICY "Anyone authenticated can view active products"
  ON public.products FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Repositor and above can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

CREATE POLICY "Repositor and above can update products"
  ON public.products FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

CREATE POLICY "Admin can delete products"
  ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para product_stock_balance
CREATE POLICY "Authenticated users can view stock balance"
  ON public.product_stock_balance FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Repositor and above can manage stock balance"
  ON public.product_stock_balance FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

-- RLS Policies para product_batches
CREATE POLICY "Authenticated users can view batches"
  ON public.product_batches FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Repositor and above can manage batches"
  ON public.product_batches FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

CREATE POLICY "Repositor and above can update batches"
  ON public.product_batches FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

-- RLS Policies para stock_movements
CREATE POLICY "Authenticated users can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Staff can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- RLS Policies para inventory_counts
CREATE POLICY "Authenticated users can view inventory counts"
  ON public.inventory_counts FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Repositor and above can insert inventory counts"
  ON public.inventory_counts FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'repositor']::public.app_role[]));

-- Triggers updated_at
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER product_stock_balance_updated_at
  BEFORE UPDATE ON public.product_stock_balance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 4: TABLAS DE CLIENTES Y CRÉDITOS
-- =============================================

-- 4.1 Tabla customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  last_name TEXT,
  document TEXT UNIQUE,
  rut TEXT,
  phone TEXT UNIQUE,
  credit_limit NUMERIC(10,2) DEFAULT 0,
  current_balance NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_document ON public.customers(document);

-- 4.2 Tabla credits
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  total_amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_credits_customer_id ON public.credits(customer_id);
CREATE INDEX idx_credits_status ON public.credits(status);

-- 4.3 Tabla credit_payments
CREATE TABLE public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID REFERENCES public.credits(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer')),
  received_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_credit_payments_credit_id ON public.credit_payments(credit_id);

-- RLS Policies para customers
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage customers"
  ON public.customers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisor can manage customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Supervisor can update customers"
  ON public.customers FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para credits
CREATE POLICY "Authenticated users can view credits"
  ON public.credits FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Cajero and above can insert credits"
  ON public.credits FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

CREATE POLICY "Cajero and above can update credits"
  ON public.credits FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- RLS Policies para credit_payments
CREATE POLICY "Authenticated users can view credit payments"
  ON public.credit_payments FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Cajero and above can insert credit payments"
  ON public.credit_payments FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- Triggers updated_at
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 5: TABLAS DE VENTAS
-- =============================================

-- 5.1 Tabla sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number SERIAL,
  cashier_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'mixed', 'credit')),
  cash_amount NUMERIC(10,2) DEFAULT 0,
  card_amount NUMERIC(10,2) DEFAULT 0,
  credit_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sales_cashier_id ON public.sales(cashier_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);
CREATE INDEX idx_sales_status ON public.sales(status);

-- 5.2 Tabla sale_items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items(product_id);

-- 5.3 Tabla pending_sales
CREATE TABLE public.pending_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pending_sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pending_sales_cashier_id ON public.pending_sales(cashier_id);

-- 5.4 Tabla sale_print_audit
CREATE TABLE public.sale_print_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  print_type TEXT DEFAULT 'receipt',
  printed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sale_print_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies para sales
CREATE POLICY "Cajero can view their own sales"
  ON public.sales FOR SELECT
  USING (auth.uid() = cashier_id OR public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Cajero and above can insert sales"
  ON public.sales FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

CREATE POLICY "Supervisor and above can update sales"
  ON public.sales FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para sale_items
CREATE POLICY "Users can view sale items of accessible sales"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Cajero and above can insert sale items"
  ON public.sale_items FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- RLS Policies para pending_sales
CREATE POLICY "Users can view their own pending sales"
  ON public.pending_sales FOR SELECT
  USING (auth.uid() = cashier_id);

CREATE POLICY "Users can insert their own pending sales"
  ON public.pending_sales FOR INSERT
  WITH CHECK (auth.uid() = cashier_id);

CREATE POLICY "Users can update their own pending sales"
  ON public.pending_sales FOR UPDATE
  USING (auth.uid() = cashier_id);

CREATE POLICY "Users can delete their own pending sales"
  ON public.pending_sales FOR DELETE
  USING (auth.uid() = cashier_id);

-- RLS Policies para sale_print_audit
CREATE POLICY "Authenticated users can view print audit"
  ON public.sale_print_audit FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated users can insert print audit"
  ON public.sale_print_audit FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- =============================================
-- FASE 6: TABLAS DE CAJAS REGISTRADORAS
-- =============================================

-- 6.1 Tabla cash_registers
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

-- 6.2 Tabla cash_register (sesiones)
CREATE TABLE public.cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  opening_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(10,2),
  expected_amount NUMERIC(10,2),
  difference NUMERIC(10,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closing', 'pending_approval', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  cash_denominations JSONB,
  card_total NUMERIC(10,2) DEFAULT 0,
  credit_sales_total NUMERIC(10,2) DEFAULT 0,
  cash_withdrawals NUMERIC(10,2) DEFAULT 0,
  other_expenses NUMERIC(10,2) DEFAULT 0,
  ticket_count INTEGER DEFAULT 0,
  difference_reason TEXT,
  requires_supervisor_approval BOOLEAN DEFAULT FALSE,
  supervisor_id UUID REFERENCES auth.users(id),
  supervisor_approved_at TIMESTAMPTZ,
  closure_type TEXT DEFAULT 'X' CHECK (closure_type IN ('X', 'Z')),
  pdf_url TEXT,
  print_type TEXT
);

ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cash_register_cashier_id ON public.cash_register(cashier_id);
CREATE INDEX idx_cash_register_status ON public.cash_register(status);
CREATE INDEX idx_cash_register_opened_at ON public.cash_register(opened_at);

-- 6.3 Tabla cash_register_sessions (modelo nuevo)
CREATE TABLE public.cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  opening_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(10,2),
  expected_amount NUMERIC(10,2),
  difference NUMERIC(10,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closing', 'pending_approval', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  cash_denominations JSONB,
  card_total NUMERIC(10,2) DEFAULT 0,
  credit_sales_total NUMERIC(10,2) DEFAULT 0,
  cash_withdrawals NUMERIC(10,2) DEFAULT 0,
  other_expenses NUMERIC(10,2) DEFAULT 0,
  ticket_count INTEGER DEFAULT 0,
  difference_reason TEXT,
  requires_supervisor_approval BOOLEAN DEFAULT FALSE,
  supervisor_id UUID REFERENCES auth.users(id),
  supervisor_approved_at TIMESTAMPTZ,
  closure_type TEXT DEFAULT 'X' CHECK (closure_type IN ('X', 'Z')),
  pdf_url TEXT,
  print_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

-- 6.4 Tabla cash_register_expenses
CREATE TABLE public.cash_register_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_register(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.cash_register_expenses ENABLE ROW LEVEL SECURITY;

-- 6.5 Tabla cash_register_audit
CREATE TABLE public.cash_register_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_register_audit ENABLE ROW LEVEL SECURITY;

-- 6.6 Tabla cash_register_takeover_audit
CREATE TABLE public.cash_register_takeover_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id),
  previous_cashier_id UUID REFERENCES auth.users(id),
  new_cashier_id UUID REFERENCES auth.users(id),
  takeover_amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_register_takeover_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies para cash_registers
CREATE POLICY "Authenticated users can view cash registers"
  ON public.cash_registers FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage cash registers"
  ON public.cash_registers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para cash_register
CREATE POLICY "Users can view their own sessions"
  ON public.cash_register FOR SELECT
  USING (auth.uid() = cashier_id OR public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Users can insert their own sessions"
  ON public.cash_register FOR INSERT
  WITH CHECK (auth.uid() = cashier_id);

CREATE POLICY "Users can update their own sessions"
  ON public.cash_register FOR UPDATE
  USING (auth.uid() = cashier_id OR public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para cash_register_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.cash_register_sessions FOR SELECT
  USING (auth.uid() = cashier_id OR public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Users can insert their own sessions"
  ON public.cash_register_sessions FOR INSERT
  WITH CHECK (auth.uid() = cashier_id);

CREATE POLICY "Users can update their own sessions"
  ON public.cash_register_sessions FOR UPDATE
  USING (auth.uid() = cashier_id OR public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para cash_register_expenses
CREATE POLICY "Authenticated users can view expenses"
  ON public.cash_register_expenses FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Cajero and above can insert expenses"
  ON public.cash_register_expenses FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- RLS Policies para cash_register_audit
CREATE POLICY "Admin and supervisor can view audit"
  ON public.cash_register_audit FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Authenticated users can insert audit"
  ON public.cash_register_audit FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- RLS Policies para cash_register_takeover_audit
CREATE POLICY "Admin and supervisor can view takeover audit"
  ON public.cash_register_takeover_audit FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Authenticated users can insert takeover audit"
  ON public.cash_register_takeover_audit FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Triggers updated_at
CREATE TRIGGER cash_registers_updated_at
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER cash_register_sessions_updated_at
  BEFORE UPDATE ON public.cash_register_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 7: TABLAS DE DEVOLUCIONES Y MERMAS
-- =============================================

-- 7.1 Tabla returns
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  return_type TEXT NOT NULL CHECK (return_type IN ('return', 'loss', 'expiry', 'damage', 'other')),
  reason TEXT,
  notes TEXT,
  refund_amount NUMERIC(10,2),
  refund_method TEXT CHECK (refund_method IN ('cash', 'card', 'credit', 'none')),
  customer_id UUID REFERENCES public.customers(id),
  related_sale_id UUID REFERENCES public.sales(id),
  performed_by UUID REFERENCES auth.users(id),
  authorized_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_returns_product_id ON public.returns(product_id);
CREATE INDEX idx_returns_created_at ON public.returns(created_at);

-- RLS Policies para returns
CREATE POLICY "Authenticated users can view returns"
  ON public.returns FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Cajero and above can insert returns"
  ON public.returns FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero', 'repositor']::public.app_role[]));

-- =============================================
-- FASE 8: TABLAS DE GASTOS Y PROVEEDORES
-- =============================================

-- 8.1 Tabla suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 8.2 Tabla expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'credit')),
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  invoice_number TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expenses_supplier_id ON public.expenses(supplier_id);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);

-- RLS Policies para suppliers
CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can manage suppliers"
  ON public.suppliers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisor can insert suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Supervisor can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para expenses
CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin and supervisor can manage expenses"
  ON public.expenses FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

CREATE POLICY "Cajero can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- Triggers updated_at
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 9: TABLAS DE NOTIFICACIONES
-- =============================================

-- 9.1 Tabla notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_sale_id UUID REFERENCES public.sales(id),
  related_customer_id UUID REFERENCES public.customers(id),
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  target_type TEXT,
  target_id UUID,
  archived BOOLEAN DEFAULT FALSE,
  read_by UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- 9.2 Tabla notification_audit
CREATE TABLE public.notification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies para notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- RLS Policies para notification_audit
CREATE POLICY "Admin can view notification audit"
  ON public.notification_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert notification audit"
  ON public.notification_audit FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Habilitar Realtime para notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================
-- FASE 10: TABLAS DE CONFIGURACIÓN
-- =============================================

-- 10.1 Tabla company_settings
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT DEFAULT 'Mi Empresa',
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  tax_id TEXT,
  currency TEXT DEFAULT 'CLP',
  receipt_footer TEXT,
  logo_url TEXT,
  stock_disabled BOOLEAN DEFAULT FALSE,
  modo_control_stock TEXT DEFAULT 'perpetuo' CHECK (modo_control_stock IN ('perpetuo', 'periodico', 'ninguno')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies para company_settings
CREATE POLICY "Anyone authenticated can view company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admin can update company settings"
  ON public.company_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insertar configuración inicial
INSERT INTO public.company_settings (company_name, currency)
VALUES ('Mi Minimarket', 'CLP');

-- Trigger updated_at
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FASE 11: TABLAS DE AUDITORÍA ADICIONALES
-- =============================================

-- 11.1 Tabla supervisor_authorizations
CREATE TABLE public.supervisor_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id),
  product_id UUID REFERENCES public.products(id),
  authorized_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT,
  quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supervisor_authorizations ENABLE ROW LEVEL SECURITY;

-- 11.2 Tabla stock_override_audit
CREATE TABLE public.stock_override_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  sale_id UUID REFERENCES public.sales(id),
  authorized_by UUID REFERENCES auth.users(id),
  requested_by UUID REFERENCES auth.users(id),
  quantity INTEGER NOT NULL,
  reason TEXT,
  stock_before INTEGER,
  stock_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_override_audit ENABLE ROW LEVEL SECURITY;

-- 11.3 Tabla price_override_logs
CREATE TABLE public.price_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id),
  user_id UUID REFERENCES auth.users(id),
  product_id UUID REFERENCES public.products(id),
  original_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.price_override_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para supervisor_authorizations
CREATE POLICY "Authenticated users can view authorizations"
  ON public.supervisor_authorizations FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Supervisor and above can insert authorizations"
  ON public.supervisor_authorizations FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- RLS Policies para stock_override_audit
CREATE POLICY "Authenticated users can view stock overrides"
  ON public.stock_override_audit FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "System can insert stock overrides"
  ON public.stock_override_audit FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- RLS Policies para price_override_logs
CREATE POLICY "Authenticated users can view price overrides"
  ON public.price_override_logs FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "System can insert price overrides"
  ON public.price_override_logs FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- =============================================
-- FASE 12: FUNCIONES AUXILIARES
-- =============================================

-- 12.1 Función get_admin_user_ids
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(user_id)
  FROM public.user_roles
  WHERE role = 'admin'
$$;

-- 12.2 Función get_admin_and_supervisor_user_ids
CREATE OR REPLACE FUNCTION public.get_admin_and_supervisor_user_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT user_id)
  FROM public.user_roles
  WHERE role IN ('admin', 'supervisor')
$$;

-- 12.3 Función sync_customer_balance
CREATE OR REPLACE FUNCTION public.sync_customer_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.customers
    SET current_balance = (
      SELECT COALESCE(SUM(balance), 0)
      FROM public.credits
      WHERE customer_id = NEW.customer_id AND status IN ('pending', 'partial')
    )
    WHERE id = NEW.customer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.customers
    SET current_balance = (
      SELECT COALESCE(SUM(balance), 0)
      FROM public.credits
      WHERE customer_id = OLD.customer_id AND status IN ('pending', 'partial')
    )
    WHERE id = OLD.customer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger para sincronizar balance de cliente
CREATE TRIGGER sync_customer_balance_on_credit_change
  AFTER INSERT OR UPDATE OR DELETE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_balance();

-- 12.4 Función update_stock_balance
CREATE OR REPLACE FUNCTION public.update_stock_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_stock_balance (product_id, current_balance, last_movement_at)
  VALUES (NEW.product_id, NEW.new_stock, NOW())
  ON CONFLICT (product_id)
  DO UPDATE SET
    current_balance = NEW.new_stock,
    last_movement_at = NOW(),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger para actualizar balance de stock
CREATE TRIGGER trigger_update_stock_balance
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_balance();

-- 12.5 Función get_cash_registers_status
CREATE OR REPLACE FUNCTION public.get_cash_registers_status()
RETURNS TABLE (
  cash_register_id UUID,
  cash_register_name TEXT,
  location TEXT,
  is_active BOOLEAN,
  current_session_id UUID,
  cashier_id UUID,
  cashier_name TEXT,
  status TEXT,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS cash_register_id,
    cr.name AS cash_register_name,
    cr.location,
    cr.is_active,
    crs.id AS current_session_id,
    crs.cashier_id,
    p.full_name AS cashier_name,
    crs.status,
    crs.opened_at,
    crs.opening_amount
  FROM public.cash_registers cr
  LEFT JOIN public.cash_register crs ON cr.id = crs.cash_register_id AND crs.status = 'open'
  LEFT JOIN public.profiles p ON crs.cashier_id = p.id
  WHERE cr.is_active = TRUE;
END;
$$;

-- =============================================
-- FASE 13: STORAGE BUCKETS
-- =============================================

-- Crear bucket para comprobantes de gastos
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', true);

-- Policies para expense-receipts bucket
CREATE POLICY "Authenticated users can view expense receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'expense-receipts');

CREATE POLICY "Admin and supervisor can upload expense receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[])
  );

CREATE POLICY "Admin can delete expense receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- FASE 14: VISTA DE PRODUCTOS POR VENCER
-- =============================================

CREATE OR REPLACE VIEW public.products_expiring_soon AS
SELECT
  pb.id AS batch_id,
  pb.product_id,
  p.name AS product_name,
  p.barcode,
  pb.batch_number,
  pb.quantity,
  pb.expiration_date,
  pb.expiration_date - CURRENT_DATE AS days_until_expiry
FROM public.product_batches pb
JOIN public.products p ON pb.product_id = p.id
WHERE pb.status = 'active'
  AND pb.quantity > 0
  AND pb.expiration_date IS NOT NULL
  AND pb.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY pb.expiration_date ASC;
