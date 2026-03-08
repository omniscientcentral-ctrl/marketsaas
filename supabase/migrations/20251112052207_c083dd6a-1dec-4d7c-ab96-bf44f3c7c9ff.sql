-- Función security definer para obtener user_ids de admins
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'admin'::app_role;
$$;

-- Función security definer para obtener user_ids de admins y supervisores
CREATE OR REPLACE FUNCTION public.get_admin_and_supervisor_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.user_roles
  WHERE role IN ('admin'::app_role, 'supervisor'::app_role);
$$;

-- Permitir que usuarios autenticados ejecuten estas funciones
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_and_supervisor_user_ids() TO authenticated;