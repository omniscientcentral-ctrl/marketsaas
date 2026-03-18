

## Problemas detectados

### 1. El CSV usa punto y coma (`;`) como separador, no coma (`,`)

El archivo tiene esta estructura:
```
name;barcode;price
MIX OCEANICO;201351;0,73
```

Pero el parser `parseCsv()` en `ImportSection.tsx` (línea 62) solo reconoce comas como separador. Resultado: las 3 columnas (`name`, `barcode`, `price`) se leen como **una sola columna** llamada `name;barcode;price`, por eso en el mapeo aparece como "Ignorada" y `name` y `price` figuran como no detectadas (X rojo).

### 2. Los decimales usan coma (`,`) en lugar de punto (`.`)

Los precios están como `0,73` en vez de `0.73`. Cuando el backend intente convertir a `number`, fallará con `"0,73" no es un número válido`.

### 3. BOM UTF-8 (`﻿`) al inicio del archivo

La primera línea tiene un carácter BOM invisible (`\uFEFF`) antes de `name`. Si no se limpia, la primera columna se detecta como `﻿name` en vez de `name`.

---

### Sobre la selección de empresa destino

El super admin **no tiene un selector explícito de empresa en la página de importación**. El componente usa `useEmpresaId()` (línea 104), que toma la empresa del **selector global** (`EmpresaSelector`) ubicado en el header/sidebar del layout. Es decir, el super admin debe cambiar la empresa desde el selector superior antes de entrar a Respaldos. Si está en modo "Global Empresas", `empresaId` será `null` y se muestra el mensaje "Debes seleccionar una empresa".

---

## Plan de corrección

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/backup/ImportSection.tsx` | Mejorar `parseCsv()` para auto-detectar separador (`;` vs `,`), limpiar BOM, y reemplazar comas decimales en campos numéricos |
| `supabase/functions/backup-restore-data/index.ts` | Normalizar comas decimales (`0,73` → `0.73`) en `parseValue()` antes de convertir a number |

### Detalle técnico

1. **Auto-detección de separador**: Leer la primera línea del CSV. Si contiene `;` y no `,` (o más `;` que `,`), usar `;` como delimitador.

2. **Limpieza de BOM**: Hacer `text.replace(/^\uFEFF/, "")` antes de parsear.

3. **Comas decimales**: En `parseValue()` del edge function, para tipo `number`, reemplazar `,` por `.` antes de `Number()` (solo si no hay más de una coma y no hay punto).

4. **Empresa destino**: Agregar un mensaje informativo en la UI que indique claramente qué empresa está seleccionada, o mostrar el nombre de la empresa destino junto al botón de importar para evitar confusión.

