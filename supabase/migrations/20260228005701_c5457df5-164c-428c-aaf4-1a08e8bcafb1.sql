ALTER TABLE stock_movements 
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements 
  ADD CONSTRAINT stock_movements_movement_type_check 
  CHECK (movement_type IN (
    'sale', 'purchase', 'adjustment', 'return', 'loss', 'transfer', 'initial',
    'ajuste_manual', 'cambio_politica', 'sale_redo_return', 'sale_cancel_return',
    'sale_edit', 'sale_edit_return'
  ));