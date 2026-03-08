
-- =============================================
-- CORRECCIÓN DE SECURITY WARNINGS
-- =============================================

-- 1. Corregir vista products_expiring_soon para usar SECURITY INVOKER
DROP VIEW IF EXISTS public.products_expiring_soon;

CREATE VIEW public.products_expiring_soon
WITH (security_invoker = on)
AS
SELECT
  pb.id AS batch_id,
  pb.product_id,
  p.name AS product_name,
  p.barcode,
  pb.batch_number,
  pb.quantity,
  pb.expiration_date,
  pb.expiration_date - CURRENT_DATE AS days_until_expiry
FROM public.product_batches pb
JOIN public.products p ON pb.product_id = p.id
WHERE pb.status = 'active'
  AND pb.quantity > 0
  AND pb.expiration_date IS NOT NULL
  AND pb.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY pb.expiration_date ASC;

-- 2. Corregir función update_updated_at con search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Reemplazar políticas WITH CHECK (TRUE) por verificaciones de rol apropiadas

-- stock_movements: solo staff con rol puede insertar
DROP POLICY IF EXISTS "Staff can insert stock movements" ON public.stock_movements;
CREATE POLICY "Staff can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero', 'repositor']::public.app_role[]));

-- sale_print_audit: cajero+ puede insertar
DROP POLICY IF EXISTS "Authenticated users can insert print audit" ON public.sale_print_audit;
CREATE POLICY "Cajero and above can insert print audit"
  ON public.sale_print_audit FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));

-- cash_register_audit: solo admin/supervisor puede insertar
DROP POLICY IF EXISTS "Authenticated users can insert audit" ON public.cash_register_audit;
CREATE POLICY "Admin and supervisor can insert audit"
  ON public.cash_register_audit FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- cash_register_takeover_audit: solo admin/supervisor puede insertar
DROP POLICY IF EXISTS "Authenticated users can insert takeover audit" ON public.cash_register_takeover_audit;
CREATE POLICY "Admin and supervisor can insert takeover audit"
  ON public.cash_register_takeover_audit FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- notifications: cajero+ puede insertar
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Staff can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero', 'repositor']::public.app_role[]));

-- notification_audit: admin puede insertar
DROP POLICY IF EXISTS "System can insert notification audit" ON public.notification_audit;
CREATE POLICY "Admin can insert notification audit"
  ON public.notification_audit FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- stock_override_audit: supervisor+ puede insertar
DROP POLICY IF EXISTS "System can insert stock overrides" ON public.stock_override_audit;
CREATE POLICY "Supervisor and above can insert stock overrides"
  ON public.stock_override_audit FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor']::public.app_role[]));

-- price_override_logs: cajero+ puede insertar (ya que editan precios con permiso)
DROP POLICY IF EXISTS "System can insert price overrides" ON public.price_override_logs;
CREATE POLICY "Staff can insert price overrides"
  ON public.price_override_logs FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'supervisor', 'cajero']::public.app_role[]));
