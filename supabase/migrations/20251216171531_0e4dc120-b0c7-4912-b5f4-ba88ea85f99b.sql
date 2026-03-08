
-- Función para crear cliente con deuda inicial de forma atómica
CREATE OR REPLACE FUNCTION create_customer_with_initial_debt(
  p_name TEXT,
  p_document TEXT DEFAULT NULL,
  p_rut TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_credit_limit NUMERIC DEFAULT 0,
  p_initial_debt NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_cashier_id UUID DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_sale_id uuid;
BEGIN
  -- Validar que si hay deuda inicial, debe haber cashier_id
  IF p_initial_debt > 0 AND p_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere cashier_id para registrar deuda inicial';
  END IF;

  -- Crear cliente
  INSERT INTO customers (name, document, rut, phone, credit_limit, current_balance, notes, status)
  VALUES (p_name, p_document, p_rut, p_phone, p_credit_limit, COALESCE(p_initial_debt, 0), p_notes, p_status)
  RETURNING id INTO v_customer_id;

  -- Si hay deuda inicial, crear venta ficticia y crédito
  IF p_initial_debt > 0 THEN
    -- Crear venta ficticia
    INSERT INTO sales (customer_id, customer_name, cashier_id, total, payment_method, credit_amount, status, notes)
    VALUES (v_customer_id, p_name, p_cashier_id, p_initial_debt, 'credito', p_initial_debt, 'completed', 'Deuda inicial registrada al crear cliente')
    RETURNING id INTO v_sale_id;

    -- Crear crédito asociado
    INSERT INTO credits (customer_id, customer_name, customer_phone, sale_id, total_amount, balance, paid_amount, status)
    VALUES (v_customer_id, p_name, p_phone, v_sale_id, p_initial_debt, p_initial_debt, 0, 'active');
  END IF;

  RETURN v_customer_id;
END;
$$;
