-- Función para recalcular manualmente todos los balances de clientes
CREATE OR REPLACE FUNCTION public.recalculate_all_customer_balances()
RETURNS TABLE(customer_id uuid, customer_name text, old_balance numeric, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE customers c
  SET current_balance = (
    SELECT COALESCE(SUM(cr.balance), 0)
    FROM credits cr
    WHERE cr.customer_id = c.id
      AND cr.status = 'active'
      AND cr.balance > 0
  ),
  updated_at = now()
  RETURNING c.id, c.name, c.current_balance as old_balance, (
    SELECT COALESCE(SUM(cr.balance), 0)
    FROM credits cr
    WHERE cr.customer_id = c.id
      AND cr.status = 'active'
      AND cr.balance > 0
  ) as new_balance;
END;
$$;

-- Ejecutar una vez para corregir los balances actuales
SELECT * FROM public.recalculate_all_customer_balances();