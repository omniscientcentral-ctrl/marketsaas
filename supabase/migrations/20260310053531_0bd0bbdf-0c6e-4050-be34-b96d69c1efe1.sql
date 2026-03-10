
-- Update handle_new_user trigger to assign default empresa_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, empresa_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    (SELECT id FROM public.empresas WHERE estado = 'activa' ORDER BY created_at ASC LIMIT 1)
  );
  RETURN NEW;
END;
$function$;
