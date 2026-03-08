-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'cajero', 'repositor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number SERIAL UNIQUE,
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_name TEXT,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'credit', 'mixed')),
  cash_amount DECIMAL(10,2),
  card_amount DECIMAL(10,2),
  credit_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create sale_items table
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Create pending_sales table (ventas en espera)
CREATE TABLE public.pending_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_name TEXT,
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pending_sales ENABLE ROW LEVEL SECURITY;

-- Create cash_register table (arqueo de caja)
CREATE TABLE public.cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  opening_amount DECIMAL(10,2) NOT NULL,
  closing_amount DECIMAL(10,2),
  expected_amount DECIMAL(10,2),
  difference DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

-- Create credits table
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Create credit_payments table
CREATE TABLE public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID REFERENCES public.credits(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  received_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- Trigger to update profiles updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER credits_updated_at
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- User roles: Users can view their own roles, admins can manage all
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Products: Repositor and above can manage, everyone can view
CREATE POLICY "Everyone can view active products"
ON public.products FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'repositor') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Repositor and above can manage products"
ON public.products FOR ALL
USING (public.has_role(auth.uid(), 'repositor') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Sales: Cajero can create and view their own, supervisor and admin can view all
CREATE POLICY "Cajero can create sales"
ON public.sales FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own sales"
ON public.sales FOR SELECT
USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supervisor and admin can update sales"
ON public.sales FOR UPDATE
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Sale items: Follow parent sale permissions
CREATE POLICY "Users can view sale items"
ON public.sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
    AND (sales.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Cajero can create sale items"
ON public.sale_items FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Pending sales: Users manage their own
CREATE POLICY "Users can manage their own pending sales"
ON public.pending_sales FOR ALL
USING (cashier_id = auth.uid());

-- Cash register: Users manage their own, supervisor and admin can view all
CREATE POLICY "Users can manage their own cash register"
ON public.cash_register FOR ALL
USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Credits: Cajero and above can manage
CREATE POLICY "Cajero and above can manage credits"
ON public.credits FOR ALL
USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- Credit payments: Cajero and above can manage
CREATE POLICY "Cajero and above can manage credit payments"
ON public.credit_payments FOR ALL
USING (public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));