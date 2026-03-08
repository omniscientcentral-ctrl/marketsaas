-- Crear tabla de cajas físicas (puntos de cobro)
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

-- Solo admin puede gestionar cajas
CREATE POLICY "Only admin can manage cash_registers"
ON public.cash_registers
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Todos los roles autenticados pueden ver cajas activas
CREATE POLICY "Authenticated users can view active cash_registers"
ON public.cash_registers
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

-- Agregar columna cash_register_id a la tabla de sesiones de caja
ALTER TABLE public.cash_register ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES public.cash_registers(id);

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_register_id ON public.cash_register(cash_register_id);

-- Trigger para updated_at
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insertar caja por defecto para compatibilidad
INSERT INTO public.cash_registers (name, location, is_active)
VALUES ('Caja Principal', 'Principal', true)
ON CONFLICT (name) DO NOTHING;

-- Crear tabla de auditoría para acciones en cajas
CREATE TABLE IF NOT EXISTS public.cash_register_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id),
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_register_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admin can view cash register audit"
ON public.cash_register_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert cash register audit"
ON public.cash_register_audit
FOR INSERT
WITH CHECK (true);