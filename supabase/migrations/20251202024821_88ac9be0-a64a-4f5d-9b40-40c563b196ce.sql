-- Actualizar función process_sale_with_movements con lógica FIFO de lotes
CREATE OR REPLACE FUNCTION public.process_sale_with_movements(_sale_id uuid, _items jsonb, _cashier_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_product record;
  v_company_settings record;
  v_result jsonb := '{"success": true, "items": []}'::jsonb;
  v_items_array jsonb := '[]'::jsonb;
  v_current_balance numeric;
  v_new_balance numeric;
  v_remaining_qty numeric;
  v_batch record;
  v_batches_used jsonb := '[]'::jsonb;
  v_batch_info jsonb;
  v_qty_from_batch numeric;
BEGIN
  -- Validar permisos
  IF NOT (
    has_role(_cashier_id, 'cajero'::app_role) OR 
    has_role(_cashier_id, 'supervisor'::app_role) OR 
    has_role(_cashier_id, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para procesar ventas';
  END IF;

  -- Obtener configuración de empresa
  SELECT modo_control_stock, stock_disabled 
  INTO v_company_settings
  FROM public.company_settings
  LIMIT 1;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_batches_used := '[]'::jsonb;

    -- Obtener datos del producto
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

    -- Validar stock solo si stock_disabled = false
    IF NOT v_product.stock_disabled AND v_new_balance < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para producto: %. Stock actual: %, Cantidad solicitada: %', 
        v_product.name, v_current_balance, v_quantity;
    END IF;

    -- Crear movimiento de stock SOLO si stock_disabled = false
    IF NOT v_product.stock_disabled THEN
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
          WHEN v_new_balance < 0 THEN 'Venta con stock negativo autorizado'
          ELSE 'Venta normal'
        END,
        _cashier_id,
        v_current_balance,
        v_new_balance,
        CASE 
          WHEN v_new_balance < 0 THEN 'negative_allowed'
          ELSE 'normal'
        END
      );
    END IF;

    -- FIFO: Descontar de lotes (SIEMPRE, independiente de stock_disabled)
    v_remaining_qty := v_quantity;
    
    FOR v_batch IN 
      SELECT id, batch_number, quantity, expiration_date
      FROM public.product_batches 
      WHERE product_id = v_product_id 
        AND status = 'active' 
        AND quantity > 0
      ORDER BY expiration_date ASC, created_at ASC
    LOOP
      IF v_remaining_qty <= 0 THEN
        EXIT;
      END IF;
      
      IF v_remaining_qty <= v_batch.quantity THEN
        -- Restar parcialmente de este lote
        v_qty_from_batch := v_remaining_qty;
        
        UPDATE public.product_batches 
        SET quantity = quantity - v_remaining_qty,
            updated_at = now()
        WHERE id = v_batch.id;
        
        v_remaining_qty := 0;
      ELSE
        -- Consumir todo el lote
        v_qty_from_batch := v_batch.quantity;
        
        UPDATE public.product_batches 
        SET quantity = 0,
            status = 'depleted',
            updated_at = now()
        WHERE id = v_batch.id;
        
        v_remaining_qty := v_remaining_qty - v_batch.quantity;
      END IF;

      -- Registrar información del lote usado
      v_batch_info := jsonb_build_object(
        'batch_id', v_batch.id,
        'batch_number', v_batch.batch_number,
        'quantity_used', v_qty_from_batch,
        'expiration_date', v_batch.expiration_date
      );
      v_batches_used := v_batches_used || v_batch_info;
    END LOOP;

    -- Agregar información del item procesado
    v_items_array := v_items_array || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'previous_stock', v_current_balance,
      'new_stock', v_new_balance,
      'stock_disabled', v_product.stock_disabled,
      'batches_used', v_batches_used,
      'insufficient_batches', v_remaining_qty > 0,
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