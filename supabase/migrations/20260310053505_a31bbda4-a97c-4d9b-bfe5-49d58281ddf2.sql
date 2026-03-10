
-- 2. Create empresas table
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa text NOT NULL DEFAULT 'Mi Empresa',
  rubro text,
  telefono text,
  email text,
  estado text NOT NULL DEFAULT 'activa',
  plan text DEFAULT 'basic',
  fecha_creacion date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- RLS: all authenticated can view (single-tenant compatible)
CREATE POLICY "Authenticated users can view empresas"
ON public.empresas FOR SELECT TO authenticated
USING (true);

-- RLS: super_admin can manage
CREATE POLICY "Super admin can manage empresas"
ON public.empresas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Add empresa_id to profiles (nullable for backward compat)
ALTER TABLE public.profiles ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);

-- 4. Insert initial empresa
INSERT INTO public.empresas (nombre_empresa, estado, plan)
VALUES ('Empresa principal', 'activa', 'basic');

-- 5. Set empresa_id for all existing profiles
UPDATE public.profiles SET empresa_id = (SELECT id FROM public.empresas LIMIT 1);

-- 6. Assign super_admin role to all current admin users
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'super_admin'::app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;
