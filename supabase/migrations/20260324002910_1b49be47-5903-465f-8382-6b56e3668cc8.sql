
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_number SERIAL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  expiration_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_purchase_orders" ON purchase_orders FOR SELECT
  USING ((empresa_id = get_user_empresa_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "insert_purchase_orders" ON purchase_orders FOR INSERT
  WITH CHECK ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "update_purchase_orders" ON purchase_orders FOR UPDATE
  USING ((empresa_id = get_user_empresa_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role])) OR has_role(auth.uid(), 'super_admin'::app_role));

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_purchase_order_items" ON purchase_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND ((po.empresa_id = get_user_empresa_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role))));
CREATE POLICY "insert_purchase_order_items" ON purchase_order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_id AND ((po.empresa_id = get_user_empresa_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role))));
