-- 1) Limpiar tablas para reintento de importación
DELETE FROM public.products;
DELETE FROM public.import_products_tmp;

-- 2) Función para normalizar precios de texto a numeric con límites seguros
CREATE OR REPLACE FUNCTION public.normalize_price(_s text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  val numeric;
BEGIN
  IF _s IS NULL THEN RETURN NULL; END IF;
  -- Reemplazar coma por punto y quitar cualquier carácter no numérico ni punto
  val := NULLIF(regexp_replace(replace(_s, ',', '.'), '[^0-9\.]', '', 'g'), '')::numeric;
  IF val IS NULL THEN RETURN NULL; END IF;
  -- Limitar a 2 decimales y tope del tipo numeric(12,2)
  IF val > 9999999999.99 THEN
    RETURN 9999999999.99;
  ELSE
    RETURN round(val::numeric, 2);
  END IF;
END;
$$;

-- 3) Procedimiento para "forzar" la importación desde la tabla temporal
--    Convierte valores, rellena faltantes y evita errores de tipos
CREATE OR REPLACE FUNCTION public.import_products_from_tmp()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar productos limpiando y convirtiendo datos
  INSERT INTO public.products (name, barcode, price, cost, stock, min_stock, active, category)
  SELECT 
    trim(name) AS name,
    NULLIF(trim(barcode), '') AS barcode,
    COALESCE(public.normalize_price(price), 0) AS price,
    0 AS cost,
    0 AS stock,
    5 AS min_stock,
    true AS active,
    NULL AS category
  FROM public.import_products_tmp
  WHERE name IS NOT NULL AND trim(name) <> '';
END;
$$;

-- Nota de uso:
-- 1) Importa el CSV a public.import_products_tmp (todas las columnas son texto)
-- 2) Ejecuta: SELECT public.import_products_from_tmp();
-- Esto forzará la conversión segura y evitará el error de numeric overflow.