-- Cambiar el tipo de retorno: eliminar y recrear la función
DROP FUNCTION IF EXISTS public.import_products_from_tmp();

CREATE OR REPLACE FUNCTION public.import_products_from_tmp()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.products (name, barcode, price, cost, stock, min_stock, active, category)
  SELECT 
    trim(name) AS name,
    CASE 
      WHEN trim(barcode) = '' OR upper(trim(barcode)) = 'NULL' THEN NULL
      ELSE trim(barcode)
    END AS barcode,
    public.normalize_price(price) AS price,
    0 AS cost,
    0 AS stock,
    5 AS min_stock,
    true AS active,
    NULL AS category
  FROM public.import_products_tmp
  WHERE name IS NOT NULL AND trim(name) <> '' AND upper(trim(name)) <> 'NULL';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;