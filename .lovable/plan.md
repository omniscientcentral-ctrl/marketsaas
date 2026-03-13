

## Plan: Hacer visible la gestión de Cajas para admin y super_admin

### Problema
La pestaña "Cajas" en `/settings` está restringida al email `soporte@soporte.com` mediante un hardcoded check (`isSupportUser`). Esto impide que los roles `admin` y `super_admin` gestionen las cajas registradoras.

### Cambio propuesto

**Archivo: `src/pages/Settings.tsx`**

Modificar la lógica de `availableTabs` para que la pestaña "Cajas" sea visible para `admin` y `super_admin`, sin depender del email de soporte:

- Tab "Cajas": visible para roles `admin` y `super_admin`
- Tab "Sistema": mantener restringido a `isSupportUser` (soporte interno)

Cambio concreto en `availableTabs`:
```text
Antes:
  ...(isSupportUser ? [
    { id: "cajas", ... },
    { id: "sistema", ... },
  ] : [])

Después:
  { id: "cajas", label: "Cajas", roles: ["admin", "super_admin"] },
  ...(isSupportUser ? [
    { id: "sistema", ... },
  ] : [])
```

También actualizar las guards de `TabsContent` para renderizar "cajas" cuando el rol sea `admin` o `super_admin` (no solo `isSupportUser`).

### Archivos a modificar
1. `src/pages/Settings.tsx` — Ajustar visibilidad de tab "Cajas"

