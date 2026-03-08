ALTER TABLE public.sale_items
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;