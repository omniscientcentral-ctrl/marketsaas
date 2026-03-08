-- Agregar campos necesarios a profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pin text,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS default_role app_role;

-- Crear tabla de auditoría de roles
CREATE TABLE IF NOT EXISTS public.role_assignment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  action text NOT NULL CHECK (action IN ('add', 'remove')),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS en role_assignment_logs
ALTER TABLE public.role_assignment_logs ENABLE ROW LEVEL SECURITY;

-- Política para que admins vean todos los logs
CREATE POLICY "Admins can view all role logs"
ON public.role_assignment_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins inserten logs
CREATE POLICY "Admins can insert role logs"
ON public.role_assignment_logs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Actualizar políticas de profiles para que admins vean todos
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view own profile or admins can view all"
ON public.profiles
FOR SELECT
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Permitir que admins actualicen cualquier perfil
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Permitir que admins inserten perfiles
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_role_assignment_logs_user_id ON public.role_assignment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignment_logs_created_at ON public.role_assignment_logs(created_at DESC);