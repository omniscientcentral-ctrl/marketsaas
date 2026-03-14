CREATE OR REPLACE VIEW public.products_expiring_soon AS
SELECT pb.id AS batch_id,
    pb.product_id,
    p.name AS product_name,
    p.barcode,
    pb.batch_number,
    pb.quantity,
    pb.expiration_date,
    (pb.expiration_date - CURRENT_DATE) AS days_until_expiry,
    p.empresa_id
FROM product_batches pb
JOIN products p ON pb.product_id = p.id
WHERE pb.status = 'active' AND pb.quantity > 0 
  AND pb.expiration_date IS NOT NULL 
  AND pb.expiration_date <= (CURRENT_DATE + '30 days'::interval)
ORDER BY pb.expiration_date;