-- 1) Cerrar sesiones duplicadas, dejando solo la más reciente por caja
WITH duplicates AS (
  SELECT 
    id,
    cash_register_id,
    opened_at,
    ROW_NUMBER() OVER (PARTITION BY cash_register_id ORDER BY opened_at DESC) AS rn
  FROM cash_register
  WHERE status = 'open'
)
UPDATE cash_register
SET status = 'closed', closed_at = NOW()
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2) RLS: Todos pueden ver las mismas cajas activas
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Only admin can manage cash_registers" ON public.cash_registers;
  DROP POLICY IF EXISTS "Authenticated users can view active cash_registers" ON public.cash_registers;
  DROP POLICY IF EXISTS "allow_select_cash_registers_active" ON public.cash_registers;
  DROP POLICY IF EXISTS "admin_manage_cash_registers" ON public.cash_registers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "allow_select_cash_registers_active"
ON public.cash_registers
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "admin_manage_cash_registers"
ON public.cash_registers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3) Índice único: una sola sesión abierta por caja
DROP INDEX IF EXISTS idx_unique_open_session_per_register;
CREATE UNIQUE INDEX idx_unique_open_session_per_register
ON public.cash_register (cash_register_id)
WHERE status = 'open';

-- 4) Vista para el selector: cajas + estado
CREATE OR REPLACE VIEW public.v_cash_registers_status AS
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