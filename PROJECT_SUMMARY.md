# MarketSaaS — Complete Project Summary

> Multi-tenant SaaS Point-of-Sale system built with React + Vite + Supabase (Lovable Cloud).
> Live: https://marketsaas.lovable.app

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| State / Data | TanStack React Query v5, React Context |
| Routing | React Router DOM v6 |
| Backend | Supabase (via Lovable Cloud): PostgreSQL, Auth, Edge Functions, Storage |
| Theme | next-themes (dark/light) |
| PDF | jspdf |
| Charts | Recharts |
| Barcode | JsBarcode |
| Forms | React Hook Form + Zod |

---

## 2. Folder Structure

```
├── public/
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── main.tsx                          # Entry point
│   ├── App.tsx                           # Router, providers
│   ├── index.css                         # Design tokens (HSL), Tailwind layers
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── ui/                           # ~45 shadcn/ui primitives (button, dialog, table, tabs, etc.)
│   │   ├── layout/
│   │   │   └── MainLayout.tsx            # Sidebar + mobile header + bottom nav shell
│   │   ├── backup/
│   │   │   ├── ExportSection.tsx          # Export data as JSON/CSV per empresa
│   │   │   ├── ImportSection.tsx          # CSV/JSON import with auto-delimiter detection
│   │   │   └── ColumnPreview.tsx          # Column mapping preview for imports
│   │   ├── cash-closure/
│   │   │   ├── CashOpenStep.tsx           # Open cash register session
│   │   │   ├── CashClosureStep1-5.tsx     # 5-step cash closure wizard
│   │   ├── cash-registers/
│   │   │   ├── CashRegisterDialog.tsx     # Create/edit cash register
│   │   │   └── CashRegisterHistoryDialog.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICards.tsx               # Revenue, sales count, avg ticket, margins
│   │   │   ├── SalesCharts.tsx            # Line/bar charts
│   │   │   ├── CashRegistersStatus.tsx    # Live register status
│   │   │   ├── ActionableLists.tsx        # Low stock, pending credits
│   │   │   ├── DashboardFilters.tsx       # Date range, category filters
│   │   │   └── ExpirationAlertBanner.tsx  # Products expiring soon alert
│   │   ├── empresas/
│   │   │   ├── EmpresaDialog.tsx          # Create/edit empresa (tenant)
│   │   │   └── AssignAdminDialog.tsx      # Assign admin user to empresa
│   │   ├── expenses/
│   │   │   ├── ExpenseDialog.tsx          # Create/edit expense
│   │   │   ├── ExpenseFilters.tsx
│   │   │   ├── ExpensesTab.tsx
│   │   │   ├── ExpensesTable.tsx
│   │   │   ├── ReceiptPreviewDialog.tsx   # View uploaded receipt image
│   │   │   ├── SupplierDialog.tsx
│   │   │   ├── SuppliersTab.tsx
│   │   │   └── SuppliersTable.tsx
│   │   ├── planes/
│   │   │   ├── PlanCard.tsx               # Plan display card
│   │   │   └── PlanDialog.tsx             # Create/edit subscription plan
│   │   ├── pos/
│   │   │   ├── ProductSearchAutocomplete.tsx  # Barcode/name product search
│   │   │   ├── PaymentModal.tsx           # Cash/card/mixed/credit payment
│   │   │   ├── CashRegisterSelectionModal.tsx
│   │   │   ├── CreditOptionsModal.tsx
│   │   │   ├── DebtPaymentModal.tsx
│   │   │   ├── CustomerSelectDialog.tsx
│   │   │   ├── CustomerActionDialog.tsx
│   │   │   ├── GenericProductDialog.tsx   # Quick add unnamed product
│   │   │   ├── CashExpenseDialog.tsx      # Register expense from POS
│   │   │   ├── PendingSalesDrawer.tsx     # Parked/pending sales
│   │   │   ├── ReturnsAndLossesDialog.tsx
│   │   │   └── SupervisorPinDialog.tsx    # PIN auth for supervisor overrides
│   │   ├── products/
│   │   │   ├── BarcodeDialog.tsx          # Generate/print barcode
│   │   │   └── ProductBatchesDialog.tsx   # Batch/lot management with expiration
│   │   ├── sales/
│   │   │   ├── SaleDetailDialog.tsx       # Full sale detail view
│   │   │   └── SalesFilters.tsx
│   │   ├── settings/
│   │   │   ├── CompanyTab.tsx             # Company settings
│   │   │   ├── UsersTab.tsx              # User management
│   │   │   ├── CashRegistersTab.tsx
│   │   │   └── SystemTab.tsx
│   │   ├── users/
│   │   │   ├── CreateUserDialog.tsx
│   │   │   ├── UserEditPanel.tsx
│   │   │   └── UserAuditDialog.tsx
│   │   ├── AppSidebar.tsx                # Desktop sidebar navigation
│   │   ├── AuthForm.tsx                  # Login/signup form
│   │   ├── BottomNav.tsx                 # Mobile bottom navigation
│   │   ├── CompanySettingsForm.tsx
│   │   ├── EmpresaSelector.tsx           # Global empresa switcher (super_admin)
│   │   ├── GlobalModeBanner.tsx          # "Read-only" banner in global mode
│   │   ├── GlobalModeGuard.tsx           # Route guard blocking write pages in global mode
│   │   ├── NotificationBell.tsx          # Notification dropdown
│   │   ├── AdminNotificationCenter.tsx
│   │   └── ThemeToggle.tsx               # Dark/light mode toggle
│   ├── config/
│   │   └── navigation.ts                # Route definitions, role-based nav items
│   ├── contexts/
│   │   └── EmpresaContext.tsx            # Global empresa (tenant) context provider
│   ├── hooks/
│   │   ├── useAuth.tsx                   # Auth state, roles, session management
│   │   ├── useEmpresaId.ts              # Returns active empresa_id for queries
│   │   ├── useGlobalMode.ts             # Check/block global mode operations
│   │   ├── useDashboardData.ts          # Dashboard KPI queries
│   │   ├── useNotifications.tsx         # Notification CRUD
│   │   ├── useProductExpiration.tsx      # Expiring product alerts
│   │   ├── useUserNavigation.ts         # Role-based navigation helper
│   │   ├── use-mobile.tsx               # Mobile breakpoint detection
│   │   └── use-toast.ts                 # Toast notification hook
│   ├── integrations/supabase/
│   │   ├── client.ts                    # Auto-generated Supabase client (DO NOT EDIT)
│   │   └── types.ts                     # Auto-generated DB types (DO NOT EDIT)
│   ├── lib/
│   │   ├── utils.ts                     # cn() utility (clsx + tailwind-merge)
│   │   ├── pdfGenerator.ts              # Cash closure PDF generation
│   │   ├── pdfSaleGenerator.ts          # Sale receipt PDF generation
│   │   ├── pdfDebtPaymentGenerator.ts   # Debt payment receipt PDF
│   │   └── silentPrint.ts               # Silent print utility
│   └── pages/
│       ├── Auth.tsx                      # Login/signup page
│       ├── Dashboard.tsx                 # Main dashboard with KPIs
│       ├── POS.tsx                       # Point of Sale terminal
│       ├── Products.tsx                  # Product catalog CRUD
│       ├── Customers.tsx                 # Customer management + credits
│       ├── Sales.tsx                     # Sales history + detail
│       ├── CashClosure.tsx              # Open/close cash register wizard
│       ├── CashClosureHistory.tsx       # Past cash closures
│       ├── CashRegistersManagement.tsx  # (legacy, redirected to settings)
│       ├── ExpensesManagement.tsx        # Expenses + suppliers
│       ├── Settings.tsx                  # Company, users, cash registers, system tabs
│       ├── Empresas.tsx                  # Tenant (empresa) management (super_admin)
│       ├── Planes.tsx                    # Subscription plan management (super_admin)
│       ├── BackupRestore.tsx             # Data export/import
│       ├── Users.tsx                     # (legacy, redirected to settings)
│       └── NotFound.tsx                  # 404 page
├── supabase/
│   ├── config.toml                      # Edge function config (DO NOT EDIT)
│   ├── functions/
│   │   ├── backup-restore-data/         # Export/import data per empresa
│   │   ├── bootstrap-super-admin/       # Initialize first super_admin
│   │   ├── create-user/                 # Create user with role + empresa assignment
│   │   ├── delete-user/                 # Delete user (auth + profile cleanup)
│   │   ├── update-user-credentials/     # Update email/password for users
│   │   ├── import-products/             # Bulk product import
│   │   ├── upsert-products/             # Product upsert by barcode
│   │   ├── cleanup-duplicate-sales/     # Data cleanup utility
│   │   ├── cleanup-products/            # Data cleanup utility
│   │   └── cleanup-test-data/           # Data cleanup utility
│   └── migrations/                      # SQL migration files (read-only)
├── .env                                 # Auto-generated env vars (DO NOT EDIT)
├── tailwind.config.ts
├── vite.config.ts
├── components.json                      # shadcn/ui config
└── package.json
```

---

## 3. Authentication & Authorization

### Auth Flow
- **Supabase Auth** with email/password (no anonymous signups)
- Email verification required (auto-confirm disabled)
- `useAuth()` hook manages session, roles, active role switching
- On login → fetches `profiles` + `user_roles` → determines navigation

### Role System (enum `app_role`)
| Role | Scope | Access |
|---|---|---|
| `super_admin` | Global (all tenants) | Everything + empresa/plan management |
| `admin` | Per-empresa | Dashboard, products, customers, sales, settings, backups |
| `supervisor` | Per-empresa | POS, products, customers, sales, settings |
| `cajero` | Per-empresa | POS, sales, expenses |
| `repositor` | Per-empresa | Products, inventory |

### Key Tables
- **`user_roles`**: `(user_id UUID, role app_role)` — separate from profiles, prevents privilege escalation
- **`profiles`**: `(id UUID PK, full_name, email, phone, empresa_id, is_active, default_role, pin, can_edit_price)`

### Security Functions
- `has_role(user_id, role)` — SECURITY DEFINER, used in all RLS policies
- `has_any_role(user_id, roles[])` — checks multiple roles
- `get_user_empresa_id(user_id)` — returns empresa_id from profile

---

## 4. Multi-Tenancy Architecture

### Core Concept
Every data table has `empresa_id UUID NOT NULL DEFAULT '<initial-empresa-uuid>'`. All queries filter by `empresa_id`.

### Key Components
- **`EmpresaContext`**: Provides `selectedEmpresaId`, `isGlobalMode`, `isSuperAdmin`
- **`useEmpresaId()`**: Returns the active empresa_id for query filtering
- **`EmpresaSelector`**: Dropdown in header for super_admin to switch empresas
- **`GLOBAL_EMPRESAS_KEY = "__global__"`**: Virtual mode for cross-tenant read-only views
- **`GlobalModeGuard`**: Route wrapper blocking write-capable pages in global mode
- **`useGlobalMode()`**: Hook with `blockIfGlobal()` utility for mutation guards

### RLS Pattern (every table)
```sql
-- SELECT: user's empresa OR super_admin
USING ((empresa_id = get_user_empresa_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'))

-- INSERT/UPDATE: user's empresa + required role OR super_admin
WITH CHECK (((empresa_id = get_user_empresa_id(auth.uid())) AND has_any_role(...)) OR has_role(auth.uid(), 'super_admin'))
```

---

## 5. Database Schema (28+ tables)

### Core Business Tables
| Table | Purpose | Key Columns |
|---|---|---|
| `empresas` | Tenants | `nombre_empresa`, `estado`, `plan` (FK→planes), `rubro`, `subdominio` |
| `planes` | Subscription plans | `nombre`, `max_usuarios`, `max_productos`, `max_cajas`, `max_sucursales`, `ai_asistente`, `whatsapp_respuestas` |
| `products` | Product catalog | `name`, `barcode`, `price`, `cost`, `stock`, `min_stock`, `category`, `active`, `stock_disabled`, `allow_negative_stock` |
| `product_batches` | Lot/batch tracking | `product_id`, `batch_number`, `quantity`, `expiration_date`, `cost`, `status` |
| `product_stock_balance` | Computed stock balance | `product_id` (unique), `current_balance`, auto-updated via trigger |
| `customers` | Customer records | `name`, `last_name`, `document`, `rut`, `phone`, `credit_limit`, `current_balance` |
| `sales` | Sale transactions | `sale_number` (auto-increment per empresa), `total`, `payment_method`, `cash_amount`, `card_amount`, `credit_amount`, `cashier_id`, `customer_id`, `cash_register_session_id` |
| `sale_items` | Line items | `sale_id`, `product_id`, `product_name`, `quantity`, `unit_price`, `subtotal` |
| `credits` | Customer credit/debt | `customer_id`, `sale_id`, `total_amount`, `paid_amount`, `balance`, `status`, `due_date` |
| `credit_payments` | Credit payment records | `credit_id`, `customer_id`, `amount`, `payment_method`, `payment_group_id` |
| `stock_movements` | Inventory audit trail | `product_id`, `movement_type`, `quantity`, `previous_stock`, `new_stock`, `reference_id`, `reason` |
| `suppliers` | Supplier directory | `name`, `phone`, `email`, `tax_id`, `is_active` |
| `expenses` | Business expenses | `amount`, `supplier_id`, `expense_date`, `payment_method`, `payment_status`, `receipt_url`, `invoice_number` |

### Cash Register Tables
| Table | Purpose |
|---|---|
| `cash_registers` | Physical register definitions (`name`, `location`, `is_active`) |
| `cash_register_sessions` | Session lifecycle (open/close with amounts, denominations) |
| `cash_register` | Legacy session table (same structure as sessions) |
| `cash_register_expenses` | Expenses linked to active register sessions |
| `cash_register_audit` | Audit trail for register actions |
| `cash_register_takeover_audit` | Cashier handoff records |

### System Tables
| Table | Purpose |
|---|---|
| `company_settings` | Per-empresa config: `company_name`, `currency`, `tax_id`, `logo_url`, `receipt_footer`, `modo_control_stock`, `cash_closure_approval_threshold`, `stock_disabled` |
| `notifications` | In-app notifications with `type`, `severity`, `read_by[]`, `target_type/id` |
| `notification_audit` | Notification action log |
| `pending_sales` | Parked/saved POS sales (JSON `items`) |
| `returns` | Product returns/losses with `return_type`, `refund_amount`, `refund_method` |
| `inventory_counts` | Physical inventory count records |
| `price_override_logs` | Audit of price changes during sales |
| `stock_override_audit` | Audit of stock override authorizations |
| `supervisor_authorizations` | Supervisor PIN authorization records |
| `sale_print_audit` | Receipt print tracking |
| `role_assignment_logs` | Role change audit trail |

### Views
- `products_expiring_soon` — Products with batches expiring within threshold

### Key Database Functions
| Function | Purpose |
|---|---|
| `process_sale_with_movements()` | Atomic sale creation with stock adjustments |
| `update_sale_items()` | Edit existing sale items with stock reconciliation |
| `assign_sale_number_per_empresa()` | Trigger: auto-increment sale_number per tenant |
| `sync_customer_balance()` | Trigger: recalculate customer debt from credits |
| `sync_stock_from_batches()` | Trigger: sync product stock from active batches |
| `update_stock_balance()` | Trigger: update product_stock_balance on movement |
| `create_customer_with_initial_debt()` | Atomic customer creation with optional initial credit |
| `handle_new_user()` | Trigger: auto-create profile on auth.users insert |
| `get_cash_registers_status()` | Returns register status with active sessions |

---

## 6. Edge Functions (Supabase)

All deployed automatically. Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations.

| Function | JWT Verify | Purpose |
|---|---|---|
| `backup-restore-data` | No (manual auth) | Export/import data per empresa. Supports `export`, `import` (with `dry_run`), `schema` actions. Validates caller is admin/super_admin. |
| `create-user` | Yes | Create auth user + profile + role assignment. Links to empresa. |
| `delete-user` | Yes | Delete user from auth + cleanup profile/roles |
| `update-user-credentials` | Yes | Update user email/password |
| `import-products` | Yes | Bulk product import |
| `upsert-products` | Yes | Upsert products by barcode |
| `bootstrap-super-admin` | Yes | Initialize first super_admin user |
| `cleanup-*` | Yes | Data cleanup utilities (duplicate sales, products, test data) |

---

## 7. Routes & Navigation

### Route Map
| Path | Page | Guard | Roles |
|---|---|---|---|
| `/auth` | Auth (login/signup) | None | Public |
| `/dashboard` | Dashboard | None | admin, super_admin |
| `/pos` | Point of Sale | GlobalModeGuard | cajero, supervisor, admin |
| `/products` | Products | GlobalModeGuard | repositor, supervisor, admin |
| `/customers` | Customers | GlobalModeGuard | supervisor, admin |
| `/sales` | Sales History | None | cajero, supervisor, admin |
| `/cash-closure` | Cash Register Wizard | GlobalModeGuard | All authenticated |
| `/cash-closure-history` | Cash Closure History | None | All authenticated |
| `/admin/gastos` | Expenses | GlobalModeGuard | cajero, supervisor, admin |
| `/admin/respaldos` | Backup & Restore | GlobalModeGuard | admin, super_admin |
| `/settings` | Settings (4 tabs) | GlobalModeGuard | supervisor, admin |
| `/empresas` | Tenant Management | None | super_admin |
| `/planes` | Plan Management | None | super_admin |

### Redirects
- `/` → `/dashboard`
- `/users` → `/settings?tab=usuarios`
- `/admin/cajas` → `/settings?tab=cajas`

### Home Page by Role
- `super_admin` / `admin` → `/dashboard`
- `supervisor` / `cajero` → `/pos`
- `repositor` → `/products`

---

## 8. State Management

| Mechanism | Scope | Usage |
|---|---|---|
| `EmpresaContext` | Global | Active empresa, super_admin mode, empresa list |
| `useAuth()` | Global (via hook) | User, session, roles, active role, sign out |
| React Query | Per-component | All Supabase data fetching with cache/invalidation |
| `localStorage` | Persistent | Active role per user, selected empresa for super_admin |
| URL params | Per-page | Filters, tab selection (`?tab=usuarios`) |

---

## 9. Key Business Logic

### Point of Sale (POS)
- Product search by barcode scan or name autocomplete
- Cart management with quantity adjustment
- 4 payment methods: cash, card, credit (fiado), mixed
- Cash register session required (select on entry)
- Pending/parked sales support
- Supervisor PIN authorization for price overrides, stock overrides, returns
- Generic (unnamed) product quick-add
- Receipt generation (PDF) with company branding

### Inventory
- Stock tracking: perpetual or batch-based (`modo_control_stock`)
- Batch/lot management with expiration dates
- Low stock alerts (below `min_stock`)
- Expiration alerts (via `products_expiring_soon` view)
- Stock movements audit trail
- Options: `stock_disabled`, `allow_negative_stock` per product

### Cash Register
- 5-step closure wizard: review → count denominations → summary → notes → confirm
- Difference detection (expected vs counted)
- Supervisor approval required above threshold
- X and Z closure types
- PDF report generation
- Takeover (cashier handoff) audit

### Credits & Debt
- Customer credit limits
- Automatic balance sync via trigger
- Partial payments with payment group tracking
- Debt payment receipts (PDF)
- Credit status lifecycle: pending → partial → paid

### Data Backup
- Export: 12 tables as JSON or CSV per empresa
- Import: products, customers, suppliers only
- CSV parser with auto-delimiter detection (`,` or `;`), BOM cleanup, decimal comma normalization
- Dry-run validation before actual import
- Schema validation with required field checking

---

## 10. Environment Variables

```env
VITE_SUPABASE_PROJECT_ID     # Supabase project ID
VITE_SUPABASE_PUBLISHABLE_KEY # Supabase anon/public key
VITE_SUPABASE_URL             # Supabase API URL
```

All auto-managed by Lovable Cloud. **Never edit `.env` manually.**

### Edge Function Secrets (server-side)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY`

---

## 11. Storage Buckets

| Bucket | Public | Usage |
|---|---|---|
| `expense-receipts` | Yes | Uploaded expense receipt images |
| `company-assets` | Yes | Company logos and branding assets |

---

## 12. Design System

- **Theme**: Dark (default) / Light via `next-themes`
- **Colors**: HSL-based semantic tokens in `index.css` (`:root` and `.dark`)
- **Primary**: Blue `221 83% 53%`
- **Custom tokens**: `--success`, `--warning`, `--info`
- **Components**: shadcn/ui (40+ Radix-based components)
- **Icons**: Lucide React
- **Language**: Spanish (UI labels, error messages, toasts)

---

## 13. Critical Rules for AI Assistants

1. **Never edit**: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, `supabase/config.toml`, `supabase/migrations/`
2. **Always filter by `empresa_id`** in all data queries
3. **Use `useEmpresaId()`** hook for empresa context in frontend
4. **Roles in separate table** (`user_roles`), never on profiles
5. **RLS on every table** — must validate `empresa_id` even for admin roles
6. **No anonymous signups** — always email/password with verification
7. **Use semantic tokens** — never hardcode colors in components
8. **Edge functions** deploy automatically — no manual deploy needed
9. **Database changes** via migration tool only
10. **Super admin** sees all empresas; regular users are scoped to their `empresa_id`
