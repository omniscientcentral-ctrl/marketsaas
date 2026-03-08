
-- RLS policies for sale_items: UPDATE and DELETE for admin/supervisor
CREATE POLICY "Admin and supervisor can update sale items"
ON public.sale_items
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]));

CREATE POLICY "Admin and supervisor can delete sale items"
ON public.sale_items
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]));

-- Function to update sale items with stock reconciliation
CREATE OR REPLACE FUNCTION public.update_sale_items(
  p_sale_id uuid,
  p_new_items jsonb,
  p_performed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_old_item record;
  v_new_item jsonb;
  v_new_total numeric := 0;
  v_old_total numeric;
  v_diff numeric;
  v_found boolean;
  v_old_qty numeric;
  v_new_qty numeric;
  v_current_stock integer;
  v_qty_diff integer;
BEGIN
  -- 1. Get original sale
  SELECT payment_method, total, credit_amount, cash_amount, card_amount
  INTO v_sale
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found: %', p_sale_id;
  END IF;

  v_old_total := v_sale.total;

  -- 2. Process old items: adjust stock for removed/reduced items
  FOR v_old_item IN
    SELECT product_id, quantity, product_name
    FROM sale_items
    WHERE sale_id = p_sale_id
  LOOP
    v_found := false;
    v_new_qty := 0;

    -- Find matching new item
    FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_new_items)
    LOOP
      IF (v_new_item->>'product_id')::uuid = v_old_item.product_id THEN
        v_found := true;
        v_new_qty := (v_new_item->>'quantity')::numeric;
        EXIT;
      END IF;
    END LOOP;

    IF v_old_item.product_id IS NOT NULL THEN
      SELECT stock INTO v_current_stock FROM products WHERE id = v_old_item.product_id;

      IF NOT v_found THEN
        -- Item removed: return all stock
        UPDATE products SET stock = stock + v_old_item.quantity::integer WHERE id = v_old_item.product_id;
        INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_id, performed_by, notes)
        VALUES (v_old_item.product_id, 'sale_edit_return', v_old_item.quantity::integer, v_current_stock, v_current_stock + v_old_item.quantity::integer, p_sale_id, p_performed_by, 'Edición de venta: item eliminado');
      ELSE
        v_qty_diff := v_old_item.quantity::integer - v_new_qty::integer;
        IF v_qty_diff > 0 THEN
          -- Quantity reduced: return difference
          UPDATE products SET stock = stock + v_qty_diff WHERE id = v_old_item.product_id;
          INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_id, performed_by, notes)
          VALUES (v_old_item.product_id, 'sale_edit_return', v_qty_diff, v_current_stock, v_current_stock + v_qty_diff, p_sale_id, p_performed_by, 'Edición de venta: cantidad reducida');
        ELSIF v_qty_diff < 0 THEN
          -- Quantity increased: discount difference
          UPDATE products SET stock = stock + v_qty_diff WHERE id = v_old_item.product_id;
          INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_id, performed_by, notes)
          VALUES (v_old_item.product_id, 'sale_edit', ABS(v_qty_diff), v_current_stock, v_current_stock + v_qty_diff, p_sale_id, p_performed_by, 'Edición de venta: cantidad aumentada');
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 3. Process new items not in old: discount stock
  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_new_items)
  LOOP
    v_found := false;
    FOR v_old_item IN SELECT product_id FROM sale_items WHERE sale_id = p_sale_id
    LOOP
      IF v_old_item.product_id = (v_new_item->>'product_id')::uuid THEN
        v_found := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_found AND (v_new_item->>'product_id') IS NOT NULL THEN
      SELECT stock INTO v_current_stock FROM products WHERE id = (v_new_item->>'product_id')::uuid;
      v_new_qty := (v_new_item->>'quantity')::numeric;

      UPDATE products SET stock = stock - v_new_qty::integer WHERE id = (v_new_item->>'product_id')::uuid;
      INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_id, performed_by, notes)
      VALUES ((v_new_item->>'product_id')::uuid, 'sale_edit', v_new_qty::integer, v_current_stock, v_current_stock - v_new_qty::integer, p_sale_id, p_performed_by, 'Edición de venta: item agregado');
    END IF;
  END LOOP;

  -- 4. Delete old items and insert new ones
  DELETE FROM sale_items WHERE sale_id = p_sale_id;

  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_new_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (
      p_sale_id,
      NULLIF(v_new_item->>'product_id', '')::uuid,
      v_new_item->>'product_name',
      (v_new_item->>'quantity')::numeric,
      (v_new_item->>'unit_price')::numeric,
      (v_new_item->>'quantity')::numeric * (v_new_item->>'unit_price')::numeric
    );
    v_new_total := v_new_total + (v_new_item->>'quantity')::numeric * (v_new_item->>'unit_price')::numeric;
  END LOOP;

  -- 5. Update sale total and payment amounts
  v_diff := v_new_total - v_old_total;

  IF v_sale.payment_method = 'cash' THEN
    UPDATE sales SET total = v_new_total, cash_amount = v_new_total WHERE id = p_sale_id;
  ELSIF v_sale.payment_method = 'card' THEN
    UPDATE sales SET total = v_new_total, card_amount = v_new_total WHERE id = p_sale_id;
  ELSIF v_sale.payment_method = 'credit' THEN
    UPDATE sales SET total = v_new_total, credit_amount = v_new_total WHERE id = p_sale_id;
    -- Update credit record
    UPDATE credits
    SET total_amount = v_new_total,
        balance = GREATEST(balance + v_diff, 0),
        updated_at = now()
    WHERE sale_id = p_sale_id AND status IN ('pending', 'partial', 'active');
  ELSIF v_sale.payment_method = 'mixed' THEN
    -- For mixed, adjust credit portion if exists, otherwise cash
    IF COALESCE(v_sale.credit_amount, 0) > 0 THEN
      UPDATE sales SET total = v_new_total, credit_amount = GREATEST(COALESCE(v_sale.credit_amount, 0) + v_diff, 0) WHERE id = p_sale_id;
      UPDATE credits
      SET total_amount = GREATEST(total_amount + v_diff, 0),
          balance = GREATEST(balance + v_diff, 0),
          updated_at = now()
      WHERE sale_id = p_sale_id AND status IN ('pending', 'partial', 'active');
    ELSE
      UPDATE sales SET total = v_new_total, cash_amount = GREATEST(COALESCE(v_sale.cash_amount, 0) + v_diff, 0) WHERE id = p_sale_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_total', v_new_total);
END;
$$;
