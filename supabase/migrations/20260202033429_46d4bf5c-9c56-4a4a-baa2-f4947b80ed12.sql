-- 1. Agregar columna email a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Actualizar trigger handle_new_user para incluir email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 3. Actualizar email del usuario actual
UPDATE public.profiles 
SET email = 'soporte@omniscient.uno' 
WHERE id = 'be6ff4ae-fc00-496e-8717-9eb6784cad7a';