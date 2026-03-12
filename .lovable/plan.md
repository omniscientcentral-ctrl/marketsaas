

## Plan: Asignar Administrador a Empresa Existente

### Objetivo
Permitir al `super_admin` asignar un usuario administrador a cualquier empresa, ya sea al crearla o después desde la tabla de empresas.

### Cambios

#### 1. Ampliar `EmpresaDialog` con sección de admin (solo al crear)
Agregar campos opcionales al formulario de creación:
- Separador visual "Administrador de la empresa"
- Nombre completo, Email, Contraseña (mínimo 6 chars), Teléfono (opcional)
- Estos campos solo aparecen cuando `!initialData` (creación, no edición)
- La interfaz `onSave` pasa los datos adicionales: `adminName`, `adminEmail`, `adminPassword`, `adminPhone`

#### 2. Agregar botón "Asignar Admin" en la tabla de empresas
- Nueva columna "Admin" en la tabla que muestra el nombre del admin actual (query join `profiles` por `empresa_id` + role `admin`)
- Botón "Asignar Admin" en cada fila que abre un diálogo específico `AssignAdminDialog`

#### 3. Crear `AssignAdminDialog` (`src/components/empresas/AssignAdminDialog.tsx`)
- Diálogo simple con campos: Nombre, Email, Contraseña, Teléfono
- Recibe `empresaId` y `empresaNombre` como props
- Al guardar, llama a `create-user` con el `empresaId`

#### 4. Actualizar `createMutation` en `Empresas.tsx`
Flujo al crear empresa con admin:
1. `INSERT empresas` → obtener `empresa.id`
2. Si hay datos de admin, llamar `supabase.functions.invoke('create-user', { body: { email, password, fullName, empresaId, roles: ['admin'], defaultRole: 'admin' } })`
3. Toast con credenciales generadas

#### 5. Actualizar edge function `create-user`
- Agregar campo opcional `empresaId?: string` a la interfaz `CreateUserRequest`
- Después de crear el usuario y que el trigger genere el perfil, si `empresaId` existe: `UPDATE profiles SET empresa_id = empresaId WHERE id = newUser.id`
- Esto sobreescribe el `empresa_id` por defecto asignado por el trigger `handle_new_user`

### Detalle técnico

**Flujo de creación combinada (empresa + admin):**
```text
1. INSERT empresas → empresa.id
2. functions.invoke('create-user', {
     email, password, fullName, phone,
     empresaId: empresa.id,
     roles: ['admin'], defaultRole: 'admin'
   })
3. Toast: "Empresa creada. Admin: email / password"
```

**Flujo de asignación posterior (empresa existente):**
```text
1. AssignAdminDialog recibe empresaId
2. functions.invoke('create-user', { ...datos, empresaId, roles: ['admin'] })
3. Toast: "Administrador asignado"
```

**Edge function cambio clave** (en `create-user/index.ts`):
```text
// Después de crear usuario y actualizar perfil:
if (body.empresaId) {
  await supabaseService.from('profiles')
    .update({ empresa_id: body.empresaId })
    .eq('id', newUser.user.id)
}
```

### Archivos a modificar
1. `src/components/empresas/EmpresaDialog.tsx` - Agregar campos de admin
2. `src/components/empresas/AssignAdminDialog.tsx` - Nuevo componente
3. `src/pages/Empresas.tsx` - Flujo de creación + botón asignar admin + query de admins
4. `supabase/functions/create-user/index.ts` - Soporte para `empresaId`

