-- Actualizar función process_sale_with_movements para soportar cantidades decimales
CREATE OR REPLACE FUNCTION public.process_sale_with_movements(_sale_id uuid, _items jsonb, _cashier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;  -- Cambiado de integer a numeric
  v_product record;
  v_company_settings record;
  v_result jsonb := '{"success": true, "items": []}'::jsonb;
  v_items_array jsonb := '[]'::jsonb;
  v_current_balance numeric;  -- Cambiado de integer a numeric
  v_new_balance numeric;  -- Cambiado de integer a numeric
BEGIN
  -- Validar permisos
  IF NOT (
    has_role(_cashier_id, 'cajero'::app_role) OR 
    has_role(_cashier_id, 'supervisor'::app_role) OR 
    has_role(_cashier_id, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para procesar ventas';
  END IF;

  -- Obtener configuración de empresa (usando stock_disabled)
  SELECT modo_control_stock, stock_disabled 
  INTO v_company_settings
  FROM public.company_settings
  LIMIT 1;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;  -- Cambiado de integer a numeric

    -- Obtener datos del producto (usando stock_disabled)
    SELECT p.id, p.name, p.stock_disabled, COALESCE(b.current_balance, 0) as stock
    INTO v_product
    FROM public.products p
    LEFT JOIN public.product_stock_balance b ON b.product_id = p.id
    WHERE p.id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
    END IF;

    v_current_balance := v_product.stock;
    v_new_balance := v_current_balance - v_quantity;

    -- Validar stock: si stock_disabled = false, validar que no sea negativo
    -- si stock_disabled = true, permitir cualquier valor
    IF NOT v_product.stock_disabled AND v_new_balance < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para producto: %. Stock actual: %, Cantidad solicitada: %', 
        v_product.name, v_current_balance, v_quantity;
    END IF;

    -- Crear movimiento de stock (cantidad negativa para venta)
    INSERT INTO public.stock_movements (
      product_id,
      movement_type,
      quantity,
      reference_id,
      notes,
      performed_by,
      previous_stock,
      new_stock,
      reason
    ) VALUES (
      v_product_id,
      'venta',
      -v_quantity,
      _sale_id,
      CASE 
        WHEN v_product.stock_disabled THEN 'Venta con stock desactivado'
        WHEN v_new_balance < 0 THEN 'Venta con stock negativo autorizado'
        ELSE 'Venta normal'
      END,
      _cashier_id,
      v_current_balance,
      v_new_balance,
      CASE 
        WHEN v_product.stock_disabled THEN 'stock_disabled'
        WHEN v_new_balance < 0 THEN 'negative_allowed'
        ELSE 'normal'
      END
    );

    v_items_array := v_items_array || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'previous_stock', v_current_balance,
      'new_stock', v_new_balance,
      'stock_disabled', v_product.stock_disabled,
      'mode', CASE 
        WHEN v_product.stock_disabled THEN 'disabled'
        WHEN v_new_balance < 0 THEN 'negative'
        ELSE 'normal'
      END
    );
  END LOOP;

  v_result := jsonb_set(v_result, '{items}', v_items_array);
  RETURN v_result;
END;
$function$;