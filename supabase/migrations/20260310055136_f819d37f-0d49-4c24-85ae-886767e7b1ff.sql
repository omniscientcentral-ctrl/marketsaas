
-- Add subdominio column to existing empresas table
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS subdominio text UNIQUE;

-- Update existing initial empresa name
UPDATE public.empresas SET nombre_empresa = 'Empresa inicial' WHERE nombre_empresa = 'Empresa principal';
