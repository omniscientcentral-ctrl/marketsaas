CREATE OR REPLACE FUNCTION public.create_customer_with_initial_debt(
  p_name text,
  p_document text DEFAULT NULL,
  p_rut text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_credit_limit numeric DEFAULT 0,
  p_initial_debt numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_cashier_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_sale_id uuid;
BEGIN
  IF p_initial_debt > 0 AND p_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere cashier_id para registrar deuda inicial';
  END IF;

  INSERT INTO customers (name, document, rut, phone, credit_limit, current_balance, notes, status)
  VALUES (p_name, p_document, p_rut, p_phone, p_credit_limit, COALESCE(p_initial_debt, 0), p_notes, p_status)
  RETURNING id INTO v_customer_id;

  IF p_initial_debt > 0 THEN
    INSERT INTO sales (customer_id, customer_name, cashier_id, total, payment_method, credit_amount, status, notes)
    VALUES (v_customer_id, p_name, p_cashier_id, p_initial_debt, 'credit', p_initial_debt, 'completed', 'Deuda inicial registrada al crear cliente')
    RETURNING id INTO v_sale_id;

    INSERT INTO credits (customer_id, customer_name, customer_phone, sale_id, total_amount, balance, paid_amount, status)
    VALUES (v_customer_id, p_name, p_phone, v_sale_id, p_initial_debt, p_initial_debt, 0, 'active');
  END IF;

  RETURN v_customer_id;
END;
$$;