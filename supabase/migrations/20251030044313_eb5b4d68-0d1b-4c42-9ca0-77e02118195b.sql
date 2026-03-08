-- Exponer estado de cajas (ocupadas/libres) para TODOS los usuarios autenticados
-- sin depender de RLS de las tablas subyacentes

-- 1) Recrear la vista vía función SECURITY DEFINER
DROP VIEW IF EXISTS public.v_cash_registers_status;

CREATE OR REPLACE FUNCTION public.get_cash_registers_status()
RETURNS TABLE (
  cash_register_id uuid,
  name text,
  location text,
  is_active boolean,
  open_session_id uuid,
  open_by_user_id uuid,
  opened_at timestamptz,
  open_by_user_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS cash_register_id,
    r.name,
    r.location,
    r.is_active,
    s.id AS open_session_id,
    s.cashier_id AS open_by_user_id,
    s.opened_at,
    p.full_name AS open_by_user_name
  FROM public.cash_registers r
  LEFT JOIN LATERAL (
    SELECT id, cashier_id, opened_at
    FROM public.cash_register
    WHERE cash_register_id = r.id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN public.profiles p ON p.id = s.cashier_id
  WHERE r.is_active = true;
$$;

-- Asegurar permisos mínimos
REVOKE ALL ON FUNCTION public.get_cash_registers_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cash_registers_status() TO authenticated;

-- 2) Vista invocadora (sin SECURITY DEFINER) que usa la función anterior
CREATE VIEW public.v_cash_registers_status
WITH (security_invoker = true)
AS
SELECT * FROM public.get_cash_registers_status();