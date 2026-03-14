

## Plan: Permitir seleccionar usuario existente en "Asignar Admin"

### Cambio

Modificar `AssignAdminDialog` para ofrecer dos modos con tabs/toggle:
1. **Seleccionar existente** — muestra un select/combobox con usuarios que no tienen `empresa_id` asignada o que pertenecen a otra empresa (profiles sin empresa o disponibles). Al seleccionar uno, se actualiza su `empresa_id` y se le asigna el rol `admin`.
2. **Crear nuevo** — formulario actual (nombre, email, contraseña, teléfono).

### Detalle técnico

**`AssignAdminDialog.tsx`**:
- Agregar estado `mode: "existing" | "new"` con toggle visual (Tabs o botones).
- En modo "existing": query `profiles` para listar usuarios disponibles (que no sean super_admin). Mostrar un Select con nombre + email.
- Al asignar usuario existente:
  - `UPDATE profiles SET empresa_id = empresaId WHERE id = selectedUserId`
  - `UPSERT user_roles` con rol `admin` para ese usuario (via edge function o directamente si RLS lo permite)
  - Como el super_admin tiene full access a profiles y user_roles, se puede hacer directamente desde el cliente.
- En modo "new": mantener el flujo actual con `create-user`.

**Flujo "existente"**:
```text
1. SELECT profiles (id, full_name, email) WHERE empresa_id IS NULL OR filtro
2. Usuario selecciona uno
3. UPDATE profiles SET empresa_id = empresaId WHERE id = selected
4. INSERT INTO user_roles (user_id, role) VALUES (selected, 'admin') ON CONFLICT DO NOTHING
5. Toast éxito
```

### Archivo a modificar
- `src/components/empresas/AssignAdminDialog.tsx`

