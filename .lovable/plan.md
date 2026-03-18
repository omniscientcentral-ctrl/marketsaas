

## Plan: Módulo de Respaldos y Datos

### Resumen

Crear una nueva página `/admin/respaldos` con dos secciones (Exportar / Importar) que permitan descargar e importar datos por empresa. La exportación se hace 100% en el frontend consultando las tablas existentes vía Supabase SDK. La importación usa una nueva Edge Function que valida y carga datos con `service_role`, forzando el `empresa_id` de destino.

### 1. Nueva Edge Function: `backup-restore-data`

Endpoint único que maneja dos acciones:

**Acción `export`:** Recibe `empresa_id` y `table_name`, consulta con `service_role` filtrado por `empresa_id`, retorna JSON. Tablas permitidas: `products`, `customers`, `suppliers`, `sales`, `sale_items`, `stock_movements`, `cash_registers`, `cash_register_sessions`, `profiles` (filtrado por empresa).

**Acción `import`:** Recibe `empresa_id`, `table_name`, `records[]` y `dry_run` (boolean).
- Valida que el caller sea `admin` de esa empresa o `super_admin`
- Whitelist de tablas importables: `products`, `customers`, `suppliers`
- Valida columnas contra un schema hardcodeado por tabla
- En modo `dry_run`: valida sin insertar, retorna errores por fila
- En modo real: inserta con `service_role`, forzando `empresa_id`, genera nuevos UUIDs, retorna conteo de éxitos/errores
- Restringe tablas transaccionales (sales, credits, stock_movements) para no romper consistencia

### 2. Nueva página: `src/pages/BackupRestore.tsx`

Dos tabs: **Exportar** e **Importar**.

**Tab Exportar:**
- Selector de empresa (usa `EmpresaSelector` existente o el contexto `useEmpresaId`)
- Checkboxes para seleccionar tablas a exportar
- Selector de formato (CSV / JSON)
- Botón "Generar respaldo" que llama a la Edge Function, convierte a CSV si necesario, y descarga el archivo

**Tab Importar:**
- Selector de empresa destino
- Selector de tipo de datos (productos, clientes, proveedores)
- Dropzone para archivo CSV/JSON
- Al cargar archivo: muestra preview de columnas detectadas vs columnas esperadas
- Botón "Validar" (dry_run=true): muestra resumen de filas válidas/inválidas con errores
- Botón "Importar" (dry_run=false): ejecuta la carga real, muestra resultado

### 3. Componentes auxiliares

| Componente | Descripción |
|---|---|
| `src/components/backup/ExportSection.tsx` | UI de exportación con selección de tablas y formato |
| `src/components/backup/ImportSection.tsx` | UI de importación con upload, preview y validación |
| `src/components/backup/ColumnPreview.tsx` | Tabla comparativa de columnas detectadas vs esperadas |

### 4. Navegación y rutas

- Agregar ruta `/admin/respaldos` en `App.tsx` (protegida con `GlobalModeGuard`)
- Agregar entrada "Respaldos" en `navigation.ts` con roles `["admin", "super_admin"]` e icono `Database`

### 5. Permisos

- La Edge Function valida que el usuario sea `admin` de la empresa destino o `super_admin`
- Para admin: solo puede exportar/importar datos de su propia empresa
- Para super_admin: puede seleccionar cualquier empresa

### 6. Schema de columnas por tabla (en la Edge Function)

```text
products:  name*, barcode, price*, stock, cost, min_stock, category, active, stock_disabled
customers: name*, last_name, document, rut, phone, address, credit_limit, notes, status
suppliers: name*, contact_name, phone, email, address, notes
```

Campos con `*` son requeridos. `id`, `empresa_id`, `created_at`, `updated_at` se generan automáticamente.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `supabase/functions/backup-restore-data/index.ts` | Nueva Edge Function |
| `src/pages/BackupRestore.tsx` | Nueva página |
| `src/components/backup/ExportSection.tsx` | Nuevo componente |
| `src/components/backup/ImportSection.tsx` | Nuevo componente |
| `src/components/backup/ColumnPreview.tsx` | Nuevo componente |
| `src/config/navigation.ts` | Agregar entrada "Respaldos" |
| `src/App.tsx` | Agregar ruta `/admin/respaldos` |

No se requieren migraciones de base de datos. Se reutilizan las tablas y RLS existentes.

