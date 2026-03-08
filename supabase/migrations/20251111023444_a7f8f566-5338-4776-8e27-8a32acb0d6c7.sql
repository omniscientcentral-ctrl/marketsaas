-- Ampliar tabla notifications con nuevos campos
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'critical')),
ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS actor_role app_role,
ADD COLUMN IF NOT EXISTS target_type text,
ADD COLUMN IF NOT EXISTS target_id uuid,
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT ARRAY[]::uuid[];

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON public.notifications(severity);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON public.notifications(archived);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target_type, target_id);

-- Tabla de auditoría de notificaciones
CREATE TABLE IF NOT EXISTS public.notification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'created', 'read', 'archived', 'failed'
  performed_by uuid REFERENCES auth.users(id),
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_audit ENABLE ROW LEVEL SECURITY;

-- RLS para notification_audit
CREATE POLICY "Admins can view notification audit"
ON public.notification_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notification audit"
ON public.notification_audit
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Actualizar políticas RLS de notifications para permitir que cajero/supervisor creen notificaciones
DROP POLICY IF EXISTS "Cajero and above can create notifications" ON public.notifications;

CREATE POLICY "Cajero and above can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Permitir que admin vea todas las notificaciones
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  (auth.uid() = actor_user_id)
);

-- Permitir que usuarios actualicen sus propias notificaciones o las que son para ellos
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Habilitar realtime para notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;