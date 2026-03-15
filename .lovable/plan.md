

## Plan: Gestor de Planes con Recursos Configurables

### Concepto

Reemplazar el campo `plan` (texto libre) en `empresas` por una referencia a una tabla `planes` donde el super_admin define cada plan con sus límites de recursos. Al asignar un plan a una empresa, esta hereda automáticamente los límites configurados.

### 1. Base de datos (2 migraciones)

**Tabla `planes`:**

```text
planes
├── id (uuid, PK)
├── nombre (text, unique, NOT NULL) -- ej: "Básico", "Pro", "Enterprise"
├── descripcion (text)
├── max_usuarios (integer, default 5)
├── max_productos (integer, default 500)
├── max_cajas (integer, default 2)
├── max_sucursales (integer, default 1)
├── ai_asistente (boolean, default false)
├── whatsapp_respuestas (boolean, default false)
├── is_active (boolean, default true)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

**RLS:** Solo `super_admin` puede CRUD, todos los autenticados pueden leer.

**Migración en `empresas`:**
- Cambiar columna `plan` de `text` a `uuid` referenciando `planes.id`
- Insertar 3 planes iniciales (Básico, Pro, Enterprise) y migrar datos existentes

### 2. Frontend - Página de Gestión de Planes

**Nueva ruta `/planes`** (solo super_admin) con:
- Listado de planes en cards con los recursos de cada uno
- Dialogo para crear/editar plan con campos numéricos para cada límite y toggles para features booleanas (IA, WhatsApp)
- Indicador de cuántas empresas usan cada plan

### 3. Frontend - Selector en EmpresaDialog

- Reemplazar el `<Select>` hardcodeado de 3 opciones por un select dinámico que consulta la tabla `planes`
- Mostrar un resumen de recursos del plan seleccionado debajo del selector

### 4. Navegación

- Agregar entrada "Planes" en `navigation.ts` (solo `super_admin`, entre Configuración y Empresas)

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| 1 migración SQL | Crear tabla `planes`, migrar columna en `empresas` |
| `src/pages/Planes.tsx` | Nueva página CRUD de planes |
| `src/components/planes/PlanDialog.tsx` | Dialog crear/editar plan |
| `src/components/planes/PlanCard.tsx` | Card visual de cada plan |
| `src/components/empresas/EmpresaDialog.tsx` | Select dinámico desde tabla `planes` |
| `src/config/navigation.ts` | Agregar ruta `/planes` |
| `src/App.tsx` | Agregar ruta |

### Detalle técnico

- La columna `empresas.plan` pasa de `text` a `uuid REFERENCES planes(id)`. Para migrar sin romper datos, se insertan los 3 planes base primero, luego se hace `UPDATE empresas SET plan = (SELECT id FROM planes WHERE nombre = ...)` según el valor actual.
- Los límites se validan en el frontend al crear usuarios/productos/cajas, comparando el count actual contra el límite del plan de la empresa.

