

## Plan: Fix "Cajas" tab not activating in Settings

### Root cause

Line 51 in `Settings.tsx`:
```typescript
if ((tabParam === "cajas" || tabParam === "sistema") && !isSupportUser) {
```

This guard was meant to restrict only the "sistema" tab to the support user, but it also blocks the "cajas" tab for everyone else. When any non-support admin clicks "Cajas", the URL updates to `?tab=cajas`, the `useEffect` fires, sees `!isSupportUser`, and resets the tab.

### Fix

**File: `src/pages/Settings.tsx`** (line 51)

Change the condition to only restrict the "sistema" tab:

```typescript
if (tabParam === "sistema" && !isSupportUser) {
```

This allows admins and super_admins to access the "cajas" tab normally while keeping "sistema" restricted to the support user.

### Files to modify
1. `src/pages/Settings.tsx` — one line change

