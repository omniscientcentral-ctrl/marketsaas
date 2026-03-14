

## Plan: Permitir asignar super_admin a empresas

### Problema
El filtro en `AssignAdminDialog` excluye a los usuarios con rol `super_admin` de la lista de usuarios disponibles (línea 46-52), impidiendo que el super_admin se asigne a sí mismo u otro super_admin a una empresa.

### Cambio

**Archivo: `src/components/empresas/AssignAdminDialog.tsx`**

Eliminar el filtro que excluye `super_admin` de la lista. Solo mantener el filtro de que el usuario no esté ya asignado a esa misma empresa:

```text
Antes:
  const superAdminIds = new Set(...);
  return profiles.filter(p => !superAdminIds.has(p.id) && p.empresa_id !== empresaId);

Después:
  return profiles.filter(p => p.empresa_id !== empresaId);
```

Esto permitirá que cualquier usuario del sistema (incluidos super_admins) aparezca como opción para ser asignado como administrador de una empresa.

