-- Función para procesar stock al finalizar una venta
-- Maneja inventario_estado='counted' (descuenta stock) y ='unknown' (acumula deuda)
CREATE OR REPLACE FUNCTION public.process_sale_stock(
  _sale_id uuid,
  _items jsonb  -- Array de {product_id, quantity}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_record record;
  v_result jsonb := '{"success": true, "items_processed": []}'::jsonb;
  v_items_array jsonb := '[]'::jsonb;
BEGIN
  -- Validar que el usuario tenga rol de cajero, supervisor o admin
  IF NOT (
    has_role(auth.uid(), 'cajero'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No tenés permisos para procesar ventas';
  END IF;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Obtener datos actuales del producto
    SELECT id, name, stock, stock_debt, inventario_estado, inventario_desde
    INTO v_product_record
    FROM products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no encontrado', v_product_id;
    END IF;

    -- Procesar según el estado de inventario
    IF v_product_record.inventario_estado = 'counted' THEN
      -- Ya inventariado: descontar del stock físico
      UPDATE products
      SET stock = stock - v_quantity,
          updated_at = now()
      WHERE id = v_product_id;

      -- Registrar movimiento de stock
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_id,
        notes,
        performed_by
      ) VALUES (
        v_product_id,
        'venta',
        -v_quantity,
        _sale_id,
        'Venta - Stock inventariado',
        auth.uid()
      );

      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_record.name,
        'action', 'stock_deducted',
        'quantity', v_quantity,
        'new_stock', v_product_record.stock - v_quantity
      );

    ELSIF v_product_record.inventario_estado = 'unknown' THEN
      -- En migración: NO tocar stock físico, solo acumular deuda
      UPDATE products
      SET stock_debt = COALESCE(stock_debt, 0) - v_quantity,
          updated_at = now()
      WHERE id = v_product_id;

      -- Registrar movimiento de deuda (para auditoría)
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity,
        reference_id,
        notes,
        performed_by
      ) VALUES (
        v_product_id,
        'deuda_venta',
        -v_quantity,
        _sale_id,
        'Venta - Producto en migración (deuda acumulada)',
        auth.uid()
      );

      v_items_array := v_items_array || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_record.name,
        'action', 'debt_accumulated',
        'quantity', v_quantity,
        'new_debt', COALESCE(v_product_record.stock_debt, 0) - v_quantity
      );

    ELSE
      -- Estado desconocido
      RAISE EXCEPTION 'Estado de inventario no válido para producto %: %', 
        v_product_record.name, v_product_record.inventario_estado;
    END IF;
  END LOOP;

  -- Construir resultado final
  v_result := jsonb_set(v_result, '{items_processed}', v_items_array);
  
  RETURN v_result;
END;
$$;

-- Crear tabla stock_movements si no existe
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  reference_id uuid,
  notes text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para stock_movements
CREATE POLICY "Repositor and above can view stock movements"
ON public.stock_movements
FOR SELECT
USING (
  has_role(auth.uid(), 'repositor'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (true);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON public.stock_movements(reference_id);