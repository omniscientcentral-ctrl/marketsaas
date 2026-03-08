-- Actualizar función process_sale_stock para registrar previous_stock, new_stock y reason
CREATE OR REPLACE FUNCTION public.process_sale_stock(_sale_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_record record;
  v_result jsonb := '{"success": true, "items_processed": []}'::jsonb;
  v_items_array jsonb := '[]'::jsonb;
  v_previous_stock integer;
  v_new_stock integer;
BEGIN
  -- Validar que el usuario tenga rol de cajero, supervisor o admin
  IF NOT (
    has_role(auth.uid(), 'cajero'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para procesar ventas';
  END IF;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Obtener datos actuales del producto
    SELECT id, name, stock, stock_debt, inventario_estado, inventario_desde, allow_negative_stock
    INTO v_product_record
    FROM products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado', v_product_id;
    END IF;

    v_previous_stock := v_product_record.stock;

    -- Procesar según el estado de inventario
    IF v_product_record.inventario_estado = 'counted' THEN
      -- Ya inventariado: descontar del stock físico
      v_new_stock := v_previous_stock - v_quantity;
      
      UPDATE products
      SET stock = v_new_stock,
          updated_at = now()
      WHERE id = v_product_id;

      -- Registrar movimiento de stock con campos de auditoría
      INSERT INTO stock_movements (
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
        'Venta - Stock inventariado',
        auth.uid(),
        v_previous_stock,
        v_new_stock,
        CASE 
          WHEN v_new_stock < 0 AND v_product_record.allow_negative_stock THEN 'Venta con stock negativo permitido'
          WHEN v_new_stock < 0 THEN 'Venta con autorización supervisor'
          ELSE 'Venta normal'
        END
      );

      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_record.name,
        'action', 'stock_deducted',
        'quantity', v_quantity,
        'previous_stock', v_previous_stock,
        'new_stock', v_new_stock
      );

    ELSIF v_product_record.inventario_estado = 'unknown' THEN
      -- En migración: NO tocar stock físico, solo acumular deuda
      UPDATE products
      SET stock_debt = COALESCE(stock_debt, 0) - v_quantity,
          updated_at = now()
      WHERE id = v_product_id;

      -- Registrar movimiento de deuda (para auditoría)
      INSERT INTO stock_movements (
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
        'deuda_venta',
        -v_quantity,
        _sale_id,
        'Venta - Producto en migración (deuda acumulada)',
        auth.uid(),
        v_previous_stock,
        v_previous_stock, -- Stock físico no cambia
        'Producto en migración - deuda acumulada'
      );

      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_record.name,
        'action', 'debt_accumulated',
        'quantity', v_quantity,
        'new_debt', COALESCE(v_product_record.stock_debt, 0) - v_quantity
      );

    ELSE
      -- Estado desconocido
      RAISE EXCEPTION 'Estado de inventario no válido para producto %: %', 
        v_product_record.name, v_product_record.inventario_estado;
    END IF;
  END LOOP;

  -- Construir resultado final
  v_result := jsonb_set(v_result, '{items_processed}', v_items_array);
  
  RETURN v_result;
END;
$function$;