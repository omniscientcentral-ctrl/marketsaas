-- Habilitar RLS en la tabla import_products_tmp
ALTER TABLE public.import_products_tmp ENABLE ROW LEVEL SECURITY;

-- Crear política para que solo admins puedan acceder a esta tabla temporal
CREATE POLICY "Only admins can access import_products_tmp"
ON public.import_products_tmp
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));