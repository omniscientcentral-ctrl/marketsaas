-- Limpiar con CASCADE para evitar error de foreign key
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.import_products_tmp;

-- Función robusta de normalización de precios con manejo de errores
CREATE OR REPLACE FUNCTION public.normalize_price(_s text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  val numeric;
  cleaned text;
BEGIN
  IF _s IS NULL OR trim(_s) = '' OR upper(trim(_s)) = 'NULL' THEN 
    RETURN 0; 
  END IF;

  -- Limpiar: permitir solo dígitos, punto y coma
  cleaned := regexp_replace(trim(_s), '[^0-9,\.]', '', 'g');
  cleaned := replace(cleaned, ',', '.');
  
  IF cleaned = '' OR cleaned = '.' THEN 
    RETURN 0; 
  END IF;

  BEGIN
    val := cleaned::numeric;
    IF val > 9999999999.99 THEN RETURN 9999999999.99; END IF;
    IF val < 0 THEN RETURN 0; END IF;
    RETURN round(val, 2);
  EXCEPTION WHEN others THEN
    RETURN 0;
  END;
END;
$$;

-- Función importadora robusta
CREATE OR REPLACE FUNCTION public.import_products_from_tmp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;