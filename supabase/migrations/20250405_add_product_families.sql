-- Migration: Add product_families table
-- Created: 2025-04-05

BEGIN;

-- ============================================
-- 1. CREATE TABLE product_families
-- ============================================
CREATE TABLE product_families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_families(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================
CREATE INDEX idx_product_families_empresa_id ON product_families(empresa_id);
CREATE INDEX idx_product_families_parent_id ON product_families(parent_id);
CREATE INDEX idx_product_families_active ON product_families(active);

-- ============================================
-- 3. ADD family_id TO products
-- ============================================
ALTER TABLE products
ADD COLUMN family_id UUID REFERENCES product_families(id) ON DELETE SET NULL;

CREATE INDEX idx_products_family_id ON products(family_id);

-- ============================================
-- 4. ENABLE RLS
-- ============================================
ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- SELECT: Users can see families from their empresa OR super_admin
CREATE POLICY "product_families_select_policy" ON product_families
FOR SELECT USING (
  (empresa_id = get_user_empresa_id(auth.uid()))
  OR has_role(auth.uid(), 'super_admin')
);

-- INSERT: admin/supervisor/super_admin
CREATE POLICY "product_families_insert_policy" ON product_families
FOR INSERT WITH CHECK (
  (
    empresa_id = get_user_empresa_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin', 'supervisor'])
  )
  OR has_role(auth.uid(), 'super_admin')
);

-- UPDATE: admin/supervisor/super_admin
CREATE POLICY "product_families_update_policy" ON product_families
FOR UPDATE USING (
  (
    empresa_id = get_user_empresa_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin', 'supervisor'])
  )
  OR has_role(auth.uid(), 'super_admin')
);

-- DELETE: super_admin only
CREATE POLICY "product_families_delete_policy" ON product_families
FOR DELETE USING (
  has_role(auth.uid(), 'super_admin')
);

-- ============================================
-- 6. TRIGGER FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_product_families_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_product_families_updated_at ON product_families;
CREATE TRIGGER set_product_families_updated_at
  BEFORE UPDATE ON product_families
  FOR EACH ROW EXECUTE FUNCTION update_product_families_updated_at();

-- ============================================
-- 7. COMMENTS
-- ============================================
COMMENT ON TABLE product_families IS 'Tabla de familias/categorías de productos (jerárquica)';
COMMENT ON COLUMN products.family_id IS 'FK a product_families.id - agrupa productos por familia';

COMMIT;
