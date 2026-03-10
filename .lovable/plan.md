

## Problem Diagnosis

1. **No profile exists** for user `093f5fa4-a3d1-4d57-9182-fd11e2553b00` (soporte@soporte.com)
2. The `handle_new_user` trigger is **not attached** to `auth.users`, so profiles are never auto-created
3. The `bootstrap-super-admin` function uses `UPDATE` on profiles, which silently does nothing when the row doesn't exist
4. The `user_roles` entry for `super_admin` exists correctly

## Fix Plan

### 1. Database Migration
- **Insert the missing profile** for the super_admin user with `empresa_id = NULL`, `default_role = 'super_admin'`, `full_name = 'Omniscient'`
- **Recreate the `handle_new_user` trigger** on `auth.users` so future user creation auto-generates profiles

### 2. Fix `bootstrap-super-admin` Edge Function
- Change `profiles.update(...)` to `profiles.upsert(...)` so it works whether the profile exists or not

### 3. Fix `useAuth.tsx` Frontend Handling
- When profile is not found but user has `super_admin` role in `user_roles`, still allow navigation (the current code aborts role loading entirely when no profile is found, leaving the user stuck)

No changes to existing users or business logic. The super_admin will see the dashboard after login and have access to all navigation items.

