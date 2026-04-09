-- Migración para añadir soporte de Impuestos y Utilidad dinámica
-- en Productos, Ventas, Compras y Gastos.

-- 1. Añadir campos a products (Aplica por defecto a los nuevos)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS iva_tipo text DEFAULT 'incluido';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS utilidad_porcentaje numeric DEFAULT 0;

-- 2. Añadir campos a sale_items
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS iva_tipo text DEFAULT 'incluido';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS iva_porcentaje numeric DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS utilidad_porcentaje numeric DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS costo_con_iva numeric DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS precio_final numeric DEFAULT 0;

-- 3. Añadir campos a purchase_order_items
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS iva_tipo text DEFAULT 'incluido';
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS iva_porcentaje numeric DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS utilidad_porcentaje numeric DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS costo_con_iva numeric DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS precio_final numeric DEFAULT 0;

-- 4. Crear tabla expense_items
CREATE TABLE IF NOT EXISTS public.expense_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id),
    product_name text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit_cost numeric NOT NULL DEFAULT 0,
    iva_tipo text DEFAULT 'incluido',
    iva_porcentaje numeric DEFAULT 0,
    utilidad_porcentaje numeric DEFAULT 0,
    costo_con_iva numeric DEFAULT 0,
    precio_final numeric DEFAULT 0,
    subtotal numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Agregar RLS para la nueva tabla
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users" ON public.expense_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.expense_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.expense_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON public.expense_items FOR DELETE TO authenticated USING (true);
