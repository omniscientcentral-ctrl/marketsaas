-- Agregar foreign key de credits.sale_id hacia sales.id
ALTER TABLE public.credits
ADD CONSTRAINT credits_sale_id_fkey 
FOREIGN KEY (sale_id) 
REFERENCES public.sales(id) 
ON DELETE SET NULL;