# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

There are no automated tests in this project.

## Architecture Overview

**OmniMarket** is a SaaS Point-of-Sale (POS) system for small retailers, built with React + Vite + TypeScript on the frontend and Supabase (PostgreSQL) as the backend.

### Tech Stack

- **React 18 + Vite + TypeScript** — frontend
- **Supabase** — auth, database, edge functions, real-time subscriptions
- **TanStack React Query** — server state and caching
- **shadcn-ui + Radix UI + Tailwind CSS** — component library and styling
- **React Hook Form + Zod** — form management and validation
- **jsPDF + JSBarcode** — receipt and report PDF generation
- **Vite PWA Plugin** — offline-capable progressive web app

### Multi-Tenancy Model

Every data record is scoped to an `empresa_id` (company ID). The `EmpresaContext` (`src/contexts/EmpresaContext.tsx`) provides the active company to the entire app. Super admins can switch between companies.

### Role-Based Access Control

Roles are managed via `useAuth` hook (`src/hooks/useAuth.tsx`) with Supabase Auth:
- `super_admin` — multi-company access, global analytics
- `admin` — company administrator
- `supervisor` — supervisory access
- `cajero` — cashier/POS operator
- `repositor` — inventory manager

Role selection is persisted in localStorage per user. The `GlobalModeGuard` component (`src/components/GlobalModeGuard.tsx`) restricts write-capable routes when super_admin is in read-only "global mode".

### Routing & Layout

- `src/App.tsx` — root component with providers (QueryClient, ThemeProvider, BrowserRouter, EmpresaProvider, Toast)
- `src/config/navigation.ts` — route definitions and role-based navigation config
- `MainLayout` wraps authenticated pages with sidebar/bottom nav
- Routes split into read-only (Dashboard, Sales, Empresas, Planes) and write-capable (POS, Products, Customers, CashClosure, Expenses, Backup — all wrapped in `<GlobalModeGuard>`)

### Data Fetching

- Supabase client: `src/integrations/supabase/client.ts`
- Auto-generated TypeScript types: `src/integrations/supabase/types.ts` (do not edit manually)
- React Query is used for caching; direct Supabase queries inside hooks under `src/hooks/`
- Real-time subscriptions via Supabase channels for live data

### Key Directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Route-level page components |
| `src/components/ui/` | shadcn-ui base components |
| `src/components/{feature}/` | Domain components (pos, products, sales, dashboard, etc.) |
| `src/hooks/` | Custom hooks — data fetching and business logic |
| `src/lib/` | Utility functions (PDF generation, silent printing) |
| `src/contexts/` | React Context providers |
| `src/integrations/supabase/` | Supabase client and generated types |
| `supabase/migrations/` | Database migration files |
| `supabase/functions/` | Supabase Edge Functions |

### Path Alias

`@/*` resolves to `./src/*` — use this for all internal imports.

### Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

### Supabase Types

When the database schema changes, regenerate types with:
```bash
npx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```
