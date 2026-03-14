

## Plan: Aislamiento de cajas por empresa

### Problema raíz

La función `get_cash_registers_status()` no filtra por `empresa_id`. Retorna **todas** las cajas activas del sistema sin importar la empresa. Esto permite que usuarios de distintas empresas vean y tomen posesión de cajas ajenas.

Además, en el frontend (`CashRegisterSelectionModal.tsx` y `CashRegistersTab.tsx`) no se pasa ni filtra `empresa_id` en ninguna query.

### Análisis de tablas

Todas las tablas operativas (`cash_registers`, `cash_register`, `cash_register_sessions`, `cash_register_audit`, etc.) **ya tienen** el campo `empresa_id` con RLS policies correctas. El problema está en:

1. **`get_cash_registers_status()`** — función `SECURITY DEFINER` que bypasea RLS y no filtra por empresa.
2. **`CashRegisterSelectionModal.tsx`** — llama a `rpc('get_cash_registers_status')` sin pasar empresa.
3. **`CashRegistersTab.tsx`** — lista cajas con `select('*')` sin filtro de empresa (aunque RLS lo cubre para usuarios normales, el super_admin ve todo sin contexto).
4. **Apertura de sesión** — el `INSERT` en `cash_register` no incluye `empresa_id` explícito (usa default de la empresa inicial).

### Correcciones

#### 1. Migración: Actualizar `get_cash_registers_status()` para aceptar y filtrar por `empresa_id`

```sql
CREATE OR REPLACE FUNCTION public.get_cash_registers_status(p_empresa_id uuid DEFAULT NULL)
RETURNS TABLE(...)
-- Agregar WHERE: 
--   WHERE cr.is_active = TRUE 
--   AND (p_empresa_id IS NULL OR cr.empresa_id = p_empresa_id)
```

Cuando se pasa `p_empresa_id`, solo retorna cajas de esa empresa. Si es NULL (super_admin sin filtro), retorna todas.

#### 2. `CashRegisterSelectionModal.tsx`
- Importar `useEmpresaId` para obtener la empresa activa.
- Pasar `empresa_id` al RPC: `supabase.rpc('get_cash_registers_status', { p_empresa_id: empresaId })`.
- En el `INSERT` de apertura de sesión, incluir `empresa_id: empresaId`.
- En la auditoría, incluir `empresa_id: empresaId`.

#### 3. `CashRegistersTab.tsx`
- Importar `useEmpresaId`.
- Agregar filtro `.eq('empresa_id', empresaId)` al listar cajas.
- Incluir `empresa_id` en inserts de auditoría.

#### 4. Cash closure flows
- Revisar `CashOpenStep.tsx` y los steps de cierre para asegurar que pasan `empresa_id` en inserts.

### Archivos a modificar
1. **Migración SQL** — actualizar función `get_cash_registers_status`
2. `src/components/pos/CashRegisterSelectionModal.tsx`
3. `src/components/settings/CashRegistersTab.tsx`
4. Archivos de cash closure si aplica (verificar en implementación)

