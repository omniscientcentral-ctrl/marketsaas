
-- 1. Create planes table
CREATE TABLE public.planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  descripcion text,
  max_usuarios integer NOT NULL DEFAULT 5,
  max_productos integer NOT NULL DEFAULT 500,
  max_cajas integer NOT NULL DEFAULT 2,
  max_sucursales integer NOT NULL DEFAULT 1,
  ai_asistente boolean NOT NULL DEFAULT false,
  whatsapp_respuestas boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view planes"
ON public.planes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can manage planes"
ON public.planes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_planes_updated_at
  BEFORE UPDATE ON public.planes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Seed plans
INSERT INTO public.planes (id, nombre, descripcion, max_usuarios, max_productos, max_cajas, max_sucursales, ai_asistente, whatsapp_respuestas)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Básico', 'Plan básico para pequeños negocios', 3, 200, 1, 1, false, false),
  ('00000000-0000-0000-0000-000000000002', 'Pro', 'Plan profesional con más recursos', 10, 2000, 4, 2, true, false),
  ('00000000-0000-0000-0000-000000000003', 'Enterprise', 'Plan empresarial sin límites prácticos', 50, 50000, 20, 10, true, true);

-- 3. Migrate empresas.plan text -> uuid
UPDATE public.empresas SET plan = '00000000-0000-0000-0000-000000000001' WHERE plan = 'basic' OR plan IS NULL OR plan = '';
UPDATE public.empresas SET plan = '00000000-0000-0000-0000-000000000002' WHERE plan = 'pro';
UPDATE public.empresas SET plan = '00000000-0000-0000-0000-000000000003' WHERE plan = 'enterprise';
UPDATE public.empresas SET plan = '00000000-0000-0000-0000-000000000001'
WHERE plan IS NOT NULL AND plan !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE public.empresas ALTER COLUMN plan DROP DEFAULT;
ALTER TABLE public.empresas ALTER COLUMN plan TYPE uuid USING plan::uuid;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_plan_fkey FOREIGN KEY (plan) REFERENCES public.planes(id);
ALTER TABLE public.empresas ALTER COLUMN plan SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
