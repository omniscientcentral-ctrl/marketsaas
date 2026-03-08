-- Crear bucket para assets de empresa (logos, etc.)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true);

-- Política para permitir upload a usuarios autenticados
CREATE POLICY "Authenticated users can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-assets');

-- Política para permitir update a usuarios autenticados
CREATE POLICY "Authenticated users can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-assets');

-- Política para permitir delete a usuarios autenticados
CREATE POLICY "Authenticated users can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-assets');

-- Política para lectura pública (logos visibles en tickets)
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');