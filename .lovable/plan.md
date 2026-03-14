

## Plan: Fix `company_settings` RLS violation for non-default empresa users

### Root cause

The `CompanySettingsForm` does not include `empresa_id` when loading or saving company settings. The `company_settings` table defaults `empresa_id` to the "Empresa Inicial" UUID, but the RLS policy requires `empresa_id = get_user_empresa_id(auth.uid())`. For users like Lucia (empresa `4d05a014-...`), the insert/update fails because the default UUID does not match her empresa.

### Fix

**`src/components/CompanySettingsForm.tsx`** -- 3 changes:

1. Import and use `useEmpresaId` hook
2. Filter the SELECT query by `empresa_id` so each company loads its own settings
3. Include `empresa_id` in both INSERT and UPDATE payloads

```typescript
import { useEmpresaId } from "@/hooks/useEmpresaId";

// Inside component:
const empresaId = useEmpresaId();

// Load: filter by empresa
.from("company_settings")
.select("*")
.eq("empresa_id", empresaId)
.maybeSingle();

// Save: include empresa_id in updateData
const updateData = { ...data, logo_url: logoUrl || null, empresa_id: empresaId };
```

### Files to modify
1. `src/components/CompanySettingsForm.tsx`

