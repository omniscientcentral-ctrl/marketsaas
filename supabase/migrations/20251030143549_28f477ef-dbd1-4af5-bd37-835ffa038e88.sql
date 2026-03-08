-- Add migration columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS inventario_estado text DEFAULT 'unknown' CHECK (inventario_estado IN ('unknown', 'counted')),
ADD COLUMN IF NOT EXISTS inventario_desde timestamp with time zone,
ADD COLUMN IF NOT EXISTS stock_debt numeric DEFAULT 0;

-- Create inventory_counts table for tracking partial counts
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_counted integer NOT NULL,
  counted_at timestamp with time zone NOT NULL DEFAULT now(),
  source text,
  notes text,
  counted_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_counts_product_id ON public.inventory_counts(product_id);
CREATE INDEX IF NOT EXISTS idx_products_inventario_estado ON public.products(inventario_estado);

-- Enable RLS on inventory_counts
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_counts
CREATE POLICY "Repositor and above can view inventory counts"
  ON public.inventory_counts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'repositor'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Repositor and above can create inventory counts"
  ON public.inventory_counts
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'repositor'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Create function to mark product as counted
CREATE OR REPLACE FUNCTION public.mark_product_counted(
  _product_id uuid,
  _qty_counted integer,
  _source text DEFAULT 'manual',
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_debt numeric;
BEGIN
  -- Get current stock_debt
  SELECT stock_debt INTO v_stock_debt
  FROM products
  WHERE id = _product_id;
  
  -- Insert count record
  INSERT INTO inventory_counts (product_id, qty_counted, source, notes, counted_by)
  VALUES (_product_id, _qty_counted, _source, _notes, auth.uid());
  
  -- Update product: set final stock = counted + debt, mark as counted
  UPDATE products
  SET 
    stock = _qty_counted + COALESCE(v_stock_debt, 0),
    inventario_estado = 'counted',
    stock_debt = 0,
    inventario_desde = now(),
    updated_at = now()
  WHERE id = _product_id;
END;
$$;

COMMENT ON FUNCTION public.mark_product_counted IS 'Marks a product as counted and adjusts stock based on counted quantity plus debt';

-- Create function to get migration progress
CREATE OR REPLACE FUNCTION public.get_migration_progress()
RETURNS TABLE(
  total_products bigint,
  counted_products bigint,
  unknown_products bigint,
  progress_percentage numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_products,
    COUNT(*) FILTER (WHERE inventario_estado = 'counted') as counted_products,
    COUNT(*) FILTER (WHERE inventario_estado = 'unknown') as unknown_products,
    ROUND(
      (COUNT(*) FILTER (WHERE inventario_estado = 'counted')::numeric / 
       NULLIF(COUNT(*), 0)::numeric * 100), 
      2
    ) as progress_percentage
  FROM products
  WHERE active = true;
$$;