

## Plan: Respaldo y Carga de Datos por Empresa (Super Admin)

### Concepto

Agregar una sección en la página de Empresas (o como nueva página) que permita al super_admin:
1. **Exportar (respaldar)** los datos operativos de una empresa en formato JSON
2. **Importar (cargar)** datos desde archivos JSON o CSV hacia una empresa específica

### Tablas operativas a respaldar/cargar

Las tablas con `empresa_id` que contienen datos del negocio:

| Tabla | Exportar | Importar | Notas |
|---|---|---|---|
| `products` | Si | Si | Core - nombre, precio, stock, barcode, categoría |
| `customers` | Si | Si | Nombre, teléfono, crédito |
| `suppliers` | Si | Si | Proveedores |
| `sales` + `sale_items` | Si | No* | Solo respaldo, no reimportar ventas |
| `credits` + `credit_payments` | Si | No* | Solo respaldo |
| `expenses` | Si | No* | Solo respaldo |
| `cash_registers` | Si | Si | Nombre, ubicación |
| `company_settings` | Si | Si | Configuración de la empresa |
| `product_batches` | Si | Si | Lotes con vencimientos |

*Las tablas transaccionales (ventas, créditos, gastos) se exportan para respaldo pero no se reimportan para evitar inconsistencias de stock/saldos.

### Arquitectura

**Edge Function `backup-restore-empresa`** con dos modos:

1. **`action: "export"`** - Recibe `empresa_id`, consulta todas las tablas con service_role, genera un JSON estructurado con metadata (nombre empresa, fecha, versión) y lo retorna.

2. **`action: "import"`** - Recibe `empresa_id` + datos (JSON o CSV parseado en frontend). Inserta los registros reemplazando el `empresa_id` con el de destino. Para CSV, soporta importación de productos y clientes (las tablas más comunes).

### Frontend

**Nueva página `/empresas/backup`** o sección dentro de Empresas con:

- Selector de empresa
- Botón "Exportar Respaldo" → descarga JSON
- Zona de carga de archivo (drag & drop) con soporte JSON/CSV
- Selector de tipo de datos al importar CSV (productos, clientes, proveedores)
- Preview de los datos antes de confirmar importación
- Barra de progreso y resumen de resultados (insertados, omitidos, errores)

### Formato JSON de respaldo

```json
{
  "version": "1.0",
  "empresa": { "id": "...", "nombre": "Mi Empresa" },
  "exported_at": "2026-03-17T...",
  "data": {
    "products": [...],
    "customers": [...],
    "suppliers": [...],
    "sales": [...],
    "sale_items": [...],
    "cash_registers": [...],
    "company_settings": [...]
  }
}
```

### Formato CSV soportado

Para productos: `nombre,codigo_barras,precio,costo,stock,categoria`
Para clientes: `nombre,apellido,telefono,documento,direccion,limite_credito`
Para proveedores: `nombre,contacto,telefono,email,direccion`

El sistema detecta automáticamente las columnas del CSV y las mapea a los campos de la tabla.

### Seguridad

- Solo accesible para `super_admin` (verificado en la Edge Function con service_role)
- Al importar, siempre se sobreescribe `empresa_id` con el de la empresa destino
- Se eliminan campos `id` de los registros importados para que se generen nuevos UUIDs
- Validación de duplicados por barcode/nombre en productos

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `supabase/functions/backup-restore-empresa/index.ts` | Nueva Edge Function |
| `src/pages/EmpresaBackup.tsx` | Nueva página de respaldo/carga |
| `src/components/backup/ExportSection.tsx` | Componente de exportación |
| `src/components/backup/ImportSection.tsx` | Componente de importación con preview |
| `src/components/backup/CsvColumnMapper.tsx` | Mapeo de columnas CSV |
| `src/App.tsx` | Agregar ruta `/empresas/backup` |
| `src/config/navigation.ts` | No se agrega al nav principal, se accede desde la tabla de Empresas |
| `src/pages/Empresas.tsx` | Agregar botón "Respaldos" por empresa |

