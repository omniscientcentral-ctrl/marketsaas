

## Plan: Agregar edición de empresas

### Cambios

**`src/pages/Empresas.tsx`**:
- Agregar estado `editingEmpresa` para almacenar los datos de la empresa a editar
- Agregar botón "Editar" en la columna de acciones de cada fila (icono Pencil)
- Al hacer click, abrir `EmpresaDialog` con `initialData` poblado desde la empresa seleccionada
- Agregar mutation `updateMutation` que haga `UPDATE` en la tabla `empresas` por `id`
- Reutilizar el mismo `EmpresaDialog` existente (ya soporta `initialData` y muestra "Editar Empresa" como título)

**`src/pages/Empresas.tsx`** — lógica del mutation:
```text
updateMutation:
  supabase.from("empresas").update({
    nombre_empresa, rubro, email, telefono, plan, subdominio
  }).eq("id", editingId)
```

No se requieren cambios en `EmpresaDialog.tsx` ya que soporta el modo edición con `initialData`.

### Archivos a modificar
1. `src/pages/Empresas.tsx`

