

## Plan: Fix credits_status_check constraint violation when creating customer with initial debt

### Root cause

The database function `create_customer_with_initial_debt` inserts a credit record with `status = 'active'`, but the `credits` table has a CHECK constraint that only allows: `pending`, `partial`, `paid`, `cancelled`.

### Fix

Run a database migration to update the `create_customer_with_initial_debt` function, changing `'active'` to `'pending'` in the credits INSERT statement.

### Changes
1. **Database migration** — ALTER the function to use `status = 'pending'` instead of `status = 'active'` when inserting into the `credits` table.

No frontend changes needed.

