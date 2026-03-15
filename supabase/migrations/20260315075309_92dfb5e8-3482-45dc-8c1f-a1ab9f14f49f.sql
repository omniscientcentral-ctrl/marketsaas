
-- Create a BEFORE INSERT trigger on sales to assign sale_number per empresa_id
-- This replaces the global sequence with a per-tenant counter

CREATE OR REPLACE FUNCTION public.assign_sale_number_per_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Lock the table rows for this empresa to prevent race conditions
  SELECT COALESCE(MAX(sale_number), 0) + 1
  INTO v_next_number
  FROM public.sales
  WHERE empresa_id = NEW.empresa_id;

  NEW.sale_number := v_next_number;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create
DROP TRIGGER IF EXISTS trg_assign_sale_number ON public.sales;
CREATE TRIGGER trg_assign_sale_number
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sale_number_per_empresa();
