-- Crear tabla de notificaciones
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_sale_id UUID,
  related_customer_id UUID,
  metadata JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias notificaciones
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Política: Cajeros y superiores pueden crear notificaciones
CREATE POLICY "Cajero and above can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Política: Los usuarios pueden actualizar sus propias notificaciones (marcar como leídas)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);