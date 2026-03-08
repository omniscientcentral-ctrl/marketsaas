-- Eliminar la constraint de foreign key que causa el error
ALTER TABLE public.returns 
DROP CONSTRAINT IF EXISTS returns_cash_register_session_id_fkey;

-- El campo ya permite NULL, solo removemos la constraint problemática
-- Esto permite registrar mermas/devoluciones incluso sin sesión de caja activa