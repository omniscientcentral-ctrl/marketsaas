
-- Allow admin/supervisor to DELETE purchase_order_items
CREATE POLICY "delete_purchase_order_items" ON purchase_order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
    AND ((po.empresa_id = get_user_empresa_id(auth.uid())
          AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))
         OR has_role(auth.uid(), 'super_admin'::app_role))
  ));

-- Allow admin/supervisor to DELETE product_batches
CREATE POLICY "Admin and supervisor can delete batches" ON product_batches FOR DELETE
  USING (
    ((empresa_id = get_user_empresa_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'supervisor'::app_role]))
     OR has_role(auth.uid(), 'super_admin'::app_role))
  );
