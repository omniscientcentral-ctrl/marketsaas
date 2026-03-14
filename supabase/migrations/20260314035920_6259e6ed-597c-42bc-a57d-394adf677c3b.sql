
CREATE OR REPLACE FUNCTION public.get_cash_registers_status(p_empresa_id uuid DEFAULT NULL)
 RETURNS TABLE(cash_register_id uuid, cash_register_name text, location text, is_active boolean, current_session_id uuid, cashier_id uuid, cashier_name text, status text, opened_at timestamp with time zone, opening_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS cash_register_id,
    cr.name AS cash_register_name,
    cr.location,
    cr.is_active,
    crs.id AS current_session_id,
    crs.cashier_id,
    p.full_name AS cashier_name,
    crs.status,
    crs.opened_at,
    crs.opening_amount
  FROM public.cash_registers cr
  LEFT JOIN public.cash_register crs ON cr.id = crs.cash_register_id AND crs.status = 'open'
  LEFT JOIN public.profiles p ON crs.cashier_id = p.id
  WHERE cr.is_active = TRUE
    AND (p_empresa_id IS NULL OR cr.empresa_id = p_empresa_id);
END;
$function$;
