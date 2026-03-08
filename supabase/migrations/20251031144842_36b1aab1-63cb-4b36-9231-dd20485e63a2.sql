-- ============================================
-- MIGRACIÓN: Modelo de Movimientos de Stock + Balance
-- Sistema de cajas compartidas con sesiones por usuario
-- ============================================

-- 1. Crear tabla de balance de stock (para lecturas rápidas)
CREATE TABLE IF NOT EXISTS public.product_stock_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_balance integer NOT NULL DEFAULT 0,
  last_movement_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_product_stock_balance_product ON public.product_stock_balance(product_id);

-- 2. Agregar modo de control de stock a configuración de empresa
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS modo_control_stock boolean NOT NULL DEFAULT false;

-- 3. Crear tabla de sesiones de caja (separada de cash_register)
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  expected_amount numeric,
  difference numeric,
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  notes text,
  cash_denominations jsonb DEFAULT '{}'::jsonb,
  card_total numeric DEFAULT 0,
  credit_sales_total numeric DEFAULT 0,
  cash_withdrawals numeric DEFAULT 0,
  other_expenses numeric DEFAULT 0,
  ticket_count integer DEFAULT 0,
  requires_supervisor_approval boolean DEFAULT false,
  supervisor_id uuid,
  supervisor_approved_at timestamp with time zone,
  pdf_url text,
  difference_reason text,
  closure_type text DEFAULT 'X' CHECK (closure_type IN ('X', 'Z')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para sesiones
CREATE INDEX idx_cash_register_sessions_register ON public.cash_register_sessions(cash_register_id);
CREATE INDEX idx_cash_register_sessions_user ON public.cash_register_sessions(user_id);
CREATE INDEX idx_cash_register_sessions_status ON public.cash_register_sessions(status);

-- 4. Crear tabla de auditoría para overrides de stock
CREATE TABLE IF NOT EXISTS public.stock_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  sale_id uuid REFERENCES public.sales(id),
  authorized_by uuid NOT NULL,
  requested_by uuid NOT NULL,
  quantity integer NOT NULL,
  reason text NOT NULL,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_override_audit_product ON public.stock_override_audit(product_id);
CREATE INDEX idx_stock_override_audit_sale ON public.stock_override_audit(sale_id);

-- 5. Crear tabla de auditoría para takeover de cajas
CREATE TABLE IF NOT EXISTS public.cash_register_takeover_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id),
  session_id uuid NOT NULL REFERENCES public.cash_register_sessions(id),
  previous_user_id uuid NOT NULL,
  new_user_id uuid NOT NULL,
  authorized_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_takeover_audit_register ON public.cash_register_takeover_audit(cash_register_id);
CREATE INDEX idx_takeover_audit_session ON public.cash_register_takeover_audit(session_id);

-- 6. Mejorar tabla stock_movements (agregar campos faltantes)
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS authorized_by uuid,
ADD COLUMN IF NOT EXISTS override_reason text;

-- 7. Eliminar columnas obsoletas del modelo anterior de productos
ALTER TABLE public.products
DROP COLUMN IF EXISTS inventario_estado,
DROP COLUMN IF EXISTS inventario_desde,
DROP COLUMN IF EXISTS stock_debt;

-- 8. Inicializar balance de stock con valores actuales
INSERT INTO public.product_stock_balance (product_id, current_balance, last_movement_at, updated_at)
SELECT 
  id,
  stock,
  updated_at,
  now()
FROM public.products
ON CONFLICT (product_id) DO UPDATE
SET current_balance = EXCLUDED.current_balance,
    updated_at = now();

-- 9. Función para actualizar balance después de movimiento
CREATE OR REPLACE FUNCTION public.update_stock_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar balance
  INSERT INTO public.product_stock_balance (product_id, current_balance, last_movement_at, updated_at)
  VALUES (
    NEW.product_id,
    NEW.quantity,
    NEW.created_at,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE
  SET 
    current_balance = product_stock_balance.current_balance + NEW.quantity,
    last_movement_at = NEW.created_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger para actualizar balance automáticamente
DROP TRIGGER IF EXISTS trigger_update_stock_balance ON public.stock_movements;
CREATE TRIGGER trigger_update_stock_balance
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_balance();

-- 10. Función para procesar venta con movimientos de stock
CREATE OR REPLACE FUNCTION public.process_sale_with_movements(
  _sale_id uuid,
  _items jsonb,
  _cashier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product record;
  v_company_settings record;
  v_result jsonb := '{"success": true, "items": []}'::jsonb;
  v_items_array jsonb := '[]'::jsonb;
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- Validar permisos
  IF NOT (
    has_role(_cashier_id, 'cajero'::app_role) OR 
    has_role(_cashier_id, 'supervisor'::app_role) OR 
    has_role(_cashier_id, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No tiene permisos para procesar ventas';
  END IF;

  -- Obtener configuración de empresa
  SELECT modo_control_stock, allow_negative_stock 
  INTO v_company_settings
  FROM public.company_settings
  LIMIT 1;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Obtener datos del producto
    SELECT p.id, p.name, p.allow_negative_stock, COALESCE(b.current_balance, 0) as stock
    INTO v_product
    FROM public.products p
    LEFT JOIN public.product_stock_balance b ON b.product_id = p.id
    WHERE p.id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_product_id;
    END IF;

    v_current_balance := v_product.stock;
    v_new_balance := v_current_balance - v_quantity;

    -- Validar stock si modo control está ON
    IF v_company_settings.modo_control_stock THEN
      IF v_new_balance < 0 AND NOT v_product.allow_negative_stock AND NOT v_company_settings.allow_negative_stock THEN
        RAISE EXCEPTION 'Stock insuficiente para producto: %. Stock actual: %, Cantidad solicitada: %', 
          v_product.name, v_current_balance, v_quantity;
      END IF;
    END IF;

    -- Crear movimiento de stock (cantidad negativa para venta)
    INSERT INTO public.stock_movements (
      product_id,
      movement_type,
      quantity,
      reference_id,
      notes,
      performed_by,
      previous_stock,
      new_stock,
      reason
    ) VALUES (
      v_product_id,
      'venta',
      -v_quantity,
      _sale_id,
      CASE 
        WHEN NOT v_company_settings.modo_control_stock THEN 'Venta en modo libre'
        WHEN v_new_balance < 0 THEN 'Venta con stock negativo autorizado'
        ELSE 'Venta normal'
      END,
      _cashier_id,
      v_current_balance,
      v_new_balance,
      CASE 
        WHEN NOT v_company_settings.modo_control_stock THEN 'modo_libre'
        WHEN v_new_balance < 0 THEN 'negative_allowed'
        ELSE 'normal'
      END
    );

    v_items_array := v_items_array || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'previous_stock', v_current_balance,
      'new_stock', v_new_balance,
      'mode', CASE 
        WHEN NOT v_company_settings.modo_control_stock THEN 'free'
        WHEN v_new_balance < 0 THEN 'negative'
        ELSE 'normal'
      END
    );
  END LOOP;

  v_result := jsonb_set(v_result, '{items}', v_items_array);
  RETURN v_result;
END;
$$;

-- 11. RLS Policies

-- product_stock_balance
ALTER TABLE public.product_stock_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock balance"
ON public.product_stock_balance FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage stock balance"
ON public.product_stock_balance FOR ALL
USING (true)
WITH CHECK (true);

-- cash_register_sessions
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.cash_register_sessions FOR SELECT
USING (
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Cajero and above can create sessions"
ON public.cash_register_sessions FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'cajero'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update their own sessions"
ON public.cash_register_sessions FOR UPDATE
USING (
  user_id = auth.uid() OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- stock_override_audit
ALTER TABLE public.stock_override_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisor and above can view override audit"
ON public.stock_override_audit FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert override audit"
ON public.stock_override_audit FOR INSERT
WITH CHECK (true);

-- cash_register_takeover_audit
ALTER TABLE public.cash_register_takeover_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisor and above can view takeover audit"
ON public.cash_register_takeover_audit FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert takeover audit"
ON public.cash_register_takeover_audit FOR INSERT
WITH CHECK (true);

-- 12. Actualizar trigger de updated_at para nuevas tablas
CREATE TRIGGER update_product_stock_balance_updated_at
BEFORE UPDATE ON public.product_stock_balance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cash_register_sessions_updated_at
BEFORE UPDATE ON public.cash_register_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();