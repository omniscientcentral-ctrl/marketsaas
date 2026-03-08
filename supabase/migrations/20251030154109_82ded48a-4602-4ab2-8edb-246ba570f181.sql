-- Función para recalcular el balance actual de un cliente
CREATE OR REPLACE FUNCTION public.sync_customer_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_total_balance numeric;
BEGIN
  -- Determinar el customer_id según la operación
  IF TG_OP = 'DELETE' THEN
    v_customer_id := OLD.customer_id;
  ELSE
    v_customer_id := NEW.customer_id;
  END IF;

  -- Calcular el balance total de los créditos activos del cliente
  SELECT COALESCE(SUM(balance), 0)
  INTO v_total_balance
  FROM public.credits
  WHERE customer_id = v_customer_id
    AND status = 'active'
    AND balance > 0;

  -- Actualizar el current_balance del cliente
  UPDATE public.customers
  SET current_balance = v_total_balance,
      updated_at = now()
  WHERE id = v_customer_id;

  RETURN NEW;
END;
$$;

-- Trigger en credits para sincronizar el balance del cliente
DROP TRIGGER IF EXISTS sync_customer_balance_on_credit_change ON public.credits;
CREATE TRIGGER sync_customer_balance_on_credit_change
AFTER INSERT OR UPDATE OR DELETE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_balance();