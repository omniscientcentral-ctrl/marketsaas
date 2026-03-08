-- Asignar rol admin al usuario soporte@omniscient.uno
INSERT INTO user_roles (user_id, role)
VALUES ('0f58167d-0ff4-4f9d-9db3-4586f3cc47c4', 'admin');

-- Establecer rol por defecto en el perfil
UPDATE profiles 
SET default_role = 'admin'
WHERE id = '0f58167d-0ff4-4f9d-9db3-4586f3cc47c4';