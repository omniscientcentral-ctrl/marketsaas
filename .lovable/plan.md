

## Plan: Fix user creation — send `empresaId` + fix Users page tenant isolation

### Problem 1: Missing `empresaId` in user creation
The `CreateUserDialog` does NOT send `empresaId` to the `create-user` edge function. New users created by an admin won't be linked to the correct empresa. The edge function already supports `empresaId` in the body.

### Problem 2: Users page shows all companies' users
`fetchUsers` in `Users.tsx` queries all `profiles` without filtering by `empresa_id`, so an admin of "RN" sees users from all empresas.

### Problem 3: UX — no clear email validation feedback
The email field doesn't validate format before submission, leading to confusing errors like "Edge Function returned a non-2xx status code" instead of "Invalid email format".

### Note on the immediate error
The user entered "Cajero01" (not a valid email) in the Email field and put the email address in the Name field. The fix below adds client-side validation to catch this earlier.

---

### Changes

#### 1. `src/components/users/CreateUserDialog.tsx`
- Accept `empresaId` as a prop
- Send `empresaId` in the edge function body
- Add basic email format validation before submission

#### 2. `src/pages/Users.tsx`
- Import `useEmpresaId`
- Pass `empresaId` to `CreateUserDialog`
- Filter `profiles` query by `.eq("empresa_id", empresaId)`
- Add `empresaId` to `useEffect` dependency array

#### 3. `src/components/settings/UsersTab.tsx` (if it renders CreateUserDialog)
- Same: pass `empresaId` prop

### Files to modify
- `src/components/users/CreateUserDialog.tsx`
- `src/pages/Users.tsx`

