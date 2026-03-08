-- 1. Crear función para crear cliente con deuda inicial
CREATE OR REPLACE FUNCTION public.create_customer_with_initial_debt(
  p_name text,
  p_last_name text DEFAULT NULL,
  p_document text DEFAULT NULL,
  p_rut text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_credit_limit numeric DEFAULT 0,
  p_initial_debt numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_cashier_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_sale_id uuid;
  v_full_name text;
BEGIN
  IF p_initial_debt > 0 AND p_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere cashier_id para registrar deuda inicial';
  END IF;

  v_full_name := TRIM(COALESCE(p_name, '') || ' ' || COALESCE(p_last_name, ''));

  INSERT INTO customers (name, last_name, document, rut, phone, address, credit_limit, current_balance, notes, status)
  VALUES (p_name, p_last_name, p_document, p_rut, p_phone, p_address, p_credit_limit, COALESCE(p_initial_debt, 0), p_notes, p_status)
  RETURNING id INTO v_customer_id;

  IF p_initial_debt > 0 THEN
    INSERT INTO sales (customer_id, customer_name, cashier_id, total, payment_method, credit_amount, status, notes)
    VALUES (v_customer_id, v_full_name, p_cashier_id, p_initial_debt, 'credit', p_initial_debt, 'completed', 'Deuda inicial registrada al crear cliente')
    RETURNING id INTO v_sale_id;

    INSERT INTO credits (customer_id, customer_name, customer_phone, sale_id, total_amount, balance, paid_amount, status)
    VALUES (v_customer_id, v_full_name, p_phone, v_sale_id, p_initial_debt, p_initial_debt, 0, 'active');
  END IF;

  RETURN v_customer_id;
END;
$$;

-- Permisos para la función
GRANT EXECUTE ON FUNCTION public.create_customer_with_initial_debt TO authenticated;

-- 2. Crear vista v_cash_registers_status
DROP VIEW IF EXISTS public.v_cash_registers_status;

CREATE VIEW public.v_cash_registers_status
WITH (security_invoker = true)
AS
SELECT * FROM public.get_cash_registers_status();

-- Permisos para la vista
GRANT SELECT ON public.v_cash_registers_status TO authenticated;

-- 3. Crear función process_sale_with_movements si no existe
CREATE OR REPLACE FUNCTION public.process_sale_with_movements(
  p_sale_data jsonb,
  p_items jsonb,
  p_stock_movements jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_movement jsonb;
BEGIN
  -- Insert the sale
  INSERT INTO sales (
    customer_id,
    customer_name,
    cashier_id,
    total,
    payment_method,
    cash_amount,
    card_amount,
    credit_amount,
    status,
    notes
  )
  VALUES (
    (p_sale_data->>'customer_id')::uuid,
    p_sale_data->>'customer_name',
    (p_sale_data->>'cashier_id')::uuid,
    (p_sale_data->>'total')::numeric,
    p_sale_data->>'payment_method',
    COALESCE((p_sale_data->>'cash_amount')::numeric, 0),
    COALESCE((p_sale_data->>'card_amount')::numeric, 0),
    COALESCE((p_sale_data->>'credit_amount')::numeric, 0),
    COALESCE(p_sale_data->>'status', 'completed'),
    p_sale_data->>'notes'
  )
  RETURNING id INTO v_sale_id;

  -- Insert sale items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal
    )
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'subtotal')::numeric
    );
  END LOOP;

  -- Process stock movements
  FOR v_movement IN SELECT * FROM jsonb_array_elements(p_stock_movements)
  LOOP
    -- Update product stock
    UPDATE products
    SET stock = stock - (v_movement->>'quantity')::integer
    WHERE id = (v_movement->>'product_id')::uuid;

    -- Record stock movement
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reference_id,
      performed_by,
      notes
    )
    VALUES (
      (v_movement->>'product_id')::uuid,
      'sale',
      (v_movement->>'quantity')::integer,
      (v_movement->>'previous_stock')::integer,
      (v_movement->>'new_stock')::integer,
      v_sale_id,
      (p_sale_data->>'cashier_id')::uuid,
      'Venta #' || v_sale_id::text
    );
  END LOOP;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale_with_movements TO authenticated;

-- 4. Añadir columna address a customers si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customers' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN address text;
  END IF;
END $$;