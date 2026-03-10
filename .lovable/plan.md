

## Plan: Gestión de Empresas para Super Admin

### Problema
No existe una página ni un menú "Empresas" en el sistema. El `super_admin` no puede crear, ver ni suspender empresas.

### Cambios necesarios

#### 1. Agregar "Empresas" a la navegación (`src/config/navigation.ts`)
- Nuevo item con icono `Building2`, path `/empresas`, rol `super_admin`
- Solo visible para `super_admin`

#### 2. Crear página `src/pages/Empresas.tsx`
- Tabla con todas las empresas: nombre, rubro, plan, estado, email, teléfono, fecha creación
- Botón "Nueva Empresa" que abre un diálogo de creación
- Acción por fila: suspender/activar empresa (cambia `estado` entre `activa` y `suspendida`)
- Protección de acceso: solo `super_admin`

#### 3. Crear componente `src/components/empresas/EmpresaDialog.tsx`
- Formulario para crear empresa con campos: nombre_empresa, rubro, email, telefono, plan, subdominio
- Usado tanto para crear como para editar

#### 4. Agregar ruta en `src/App.tsx`
- `<Route path="/empresas" element={<Empresas />} />`

#### 5. RLS - Sin cambios necesarios
Las políticas RLS ya existen:
- `super_admin` tiene `ALL` access en `empresas`
- Authenticated users tienen `SELECT` access

No se modifica ninguna tabla ni lógica existente. Solo se agrega la interfaz de gestión.

