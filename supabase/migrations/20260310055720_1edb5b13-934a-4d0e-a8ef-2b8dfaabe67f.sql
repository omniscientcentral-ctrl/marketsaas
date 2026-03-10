
DO $$
DECLARE
  v_empresa_id uuid;
  v_tables text[] := ARRAY[
    'products','customers','sales','sale_items','stock_movements','suppliers',
    'cash_registers','cash_register','cash_register_sessions','cash_register_expenses',
    'cash_register_audit','cash_register_takeover_audit','credits','credit_payments',
    'expenses','pending_sales','returns','product_batches','product_stock_balance',
    'inventory_counts','notifications','notification_audit','price_override_logs',
    'sale_print_audit','stock_override_audit','supervisor_authorizations',
    'role_assignment_logs','company_settings'
  ];
  v_tbl text;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre_empresa = 'Empresa inicial' LIMIT 1;
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa inicial not found';
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    -- Add column nullable
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id)', v_tbl);
    -- Set existing rows
    EXECUTE format('UPDATE public.%I SET empresa_id = %L WHERE empresa_id IS NULL', v_tbl, v_empresa_id);
    -- Set default and NOT NULL
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT %L', v_tbl, v_empresa_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN empresa_id SET NOT NULL', v_tbl);
  END LOOP;
END $$;
