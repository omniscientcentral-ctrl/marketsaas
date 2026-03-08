-- Crear bucket para assets de la empresa
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true);

-- Política para subir archivos (solo admin)
CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Política para actualizar archivos (solo admin)
CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Política para eliminar archivos (solo admin)
CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Política para ver archivos (público)
CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');