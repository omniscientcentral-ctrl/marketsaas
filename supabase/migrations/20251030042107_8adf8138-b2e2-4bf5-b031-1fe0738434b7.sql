-- Recrear la vista sin SECURITY DEFINER
DROP VIEW IF EXISTS public.v_cash_registers_status;

CREATE VIEW public.v_cash_registers_status
WITH (security_invoker=true)
AS
SELECT
  r.id               AS cash_register_id,
  r.name,
  r.location,
  r.is_active,
  s.id               AS open_session_id,
  s.cashier_id       AS open_by_user_id,
  s.opened_at,
  p.full_name        AS open_by_user_name
FROM cash_registers r
LEFT JOIN LATERAL (
  SELECT id, cashier_id, opened_at
  FROM cash_register
  WHERE cash_register_id = r.id AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1
) s ON true
LEFT JOIN profiles p ON p.id = s.cashier_id
WHERE r.is_active = true;