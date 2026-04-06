-- Create product_families table
CREATE TABLE IF NOT EXISTS product_families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add family_id to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES product_families(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_product_families_empresa_id ON product_families(empresa_id);
CREATE INDEX IF NOT EXISTS idx_products_family_id ON products(family_id);

-- Enable RLS
ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

-- Policies for product_families
-- Policy 1: Users can view families from their company
CREATE POLICY "Users can view their own company's product families"
  ON product_families FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM profiles WHERE id = CAST(auth.uid() AS UUID)
    )
  );

-- Policy 2: Admins and supervisors can insert product families
CREATE POLICY "Admins and supervisors can insert product families"
  ON product_families FOR INSERT
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM user_roles
      WHERE user_id = auth.uid()::text
      AND role IN ('admin', 'supervisor', 'super_admin')
    )
  );

-- Policy 3: Admins and supervisors can update product families
CREATE POLICY "Admins and supervisors can update product families"
  ON product_families FOR UPDATE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM user_roles
      WHERE user_id = auth.uid()::text
      AND role IN ('admin', 'supervisor', 'super_admin')
    )
  );

-- Policy 4: Admins and supervisors can delete product families
CREATE POLICY "Admins and supervisors can delete product families"
  ON product_families FOR DELETE
  USING (
    empresa_id IN (
      SELECT empresa_id FROM user_roles
      WHERE user_id = auth.uid()::text
      AND role IN ('admin', 'supervisor', 'super_admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER set_product_families_updated_at
  BEFORE UPDATE ON product_families
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
