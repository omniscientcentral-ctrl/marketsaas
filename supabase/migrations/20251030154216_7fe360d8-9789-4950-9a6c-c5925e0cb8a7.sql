-- Sincronizar el current_balance de todos los clientes con sus créditos activos
UPDATE public.customers c
SET 
  current_balance = COALESCE(
    (SELECT SUM(balance) 
     FROM public.credits 
     WHERE customer_id = c.id 
       AND status = 'active' 
       AND balance > 0),
    0
  ),
  updated_at = now()
WHERE id IN (SELECT DISTINCT customer_id FROM public.credits);