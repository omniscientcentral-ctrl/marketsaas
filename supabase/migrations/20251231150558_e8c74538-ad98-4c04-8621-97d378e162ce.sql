-- Agregar columna last_name a customers
ALTER TABLE public.customers ADD COLUMN last_name text;

-- Actualizar función create_customer_with_initial_debt para incluir last_name
CREATE OR REPLACE FUNCTION public.create_customer_with_initial_debt(
  p_name text, 
  p_last_name text DEFAULT NULL,
  p_document text DEFAULT NULL::text, 
  p_rut text DEFAULT NULL::text, 
  p_phone text DEFAULT NULL::text, 
  p_credit_limit numeric DEFAULT 0, 
  p_initial_debt numeric DEFAULT 0, 
  p_notes text DEFAULT NULL::text, 
  p_status text DEFAULT 'active'::text, 
  p_cashier_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_sale_id uuid;
  v_full_name text;
BEGIN
  IF p_initial_debt > 0 AND p_cashier_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere cashier_id para registrar deuda inicial';
  END IF;

  -- Construir nombre completo para referencias
  v_full_name := TRIM(COALESCE(p_name, '') || ' ' || COALESCE(p_last_name, ''));

  INSERT INTO customers (name, last_name, document, rut, phone, credit_limit, current_balance, notes, status)
  VALUES (p_name, p_last_name, p_document, p_rut, p_phone, p_credit_limit, COALESCE(p_initial_debt, 0), p_notes, p_status)
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
$function$;