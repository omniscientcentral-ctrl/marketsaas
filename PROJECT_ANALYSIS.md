# PROJECT_ANALYSIS.md — MarketSaaS

> Última actualización: 2026-03-28
> Archivo generado para contexto completo de un asistente externo.

---

## 1. TABLAS DE BASE DE DATOS

### 1.1 Tablas principales

#### `profiles`
- **Propósito:** Información extendida de usuarios (no usar auth.users directamente).
- **Columnas clave:** `id` (UUID, PK, ref auth.users), `full_name`, `email`, `phone`, `pin`, `empresa_id` (FK empresas), `is_active`, `default_role` (app_role enum), `can_edit_price`, `price_edit_unlocked_at`
- **RLS:** Users ven su propio perfil; admins ven/editan todos los de su empresa; super_admin acceso total.
- **Trigger:** `handle_new_user()` — crea perfil automáticamente al registrarse un usuario en auth.users.

#### `user_roles`
- **Propósito:** Roles de usuario separados de profiles (seguridad).
- **Columnas:** `id`, `user_id` (UUID), `role` (app_role enum: admin, supervisor, cajero, repositor, super_admin), `created_at`
- **Constraint:** UNIQUE(user_id, role)
- **RLS:** Users ven sus propios roles; admins gestionan todos; super_admin acceso total.

#### `empresas`
- **Propósito:** Entidades empresariales (multi-tenant).
- **Columnas:** `id`, `nombre_empresa`, `estado` (activa/inactiva), `plan` (FK planes), `rubro`, `subdominio`, `email`, `telefono`, `fecha_creacion`
- **RLS:** Según rol y empresa_id del usuario.

#### `planes`
- **Propósito:** Planes de suscripción con límites.
- **Columnas:** `id`, `nombre`, `descripcion`, `max_usuarios`, `max_productos`, `max_cajas`, `max_sucursales`, `ai_asistente`, `whatsapp_respuestas`, `is_active`
- **RLS:** Todos los autenticados pueden ver; super_admin gestiona.

#### `products`
- **Propósito:** Catálogo de productos.
- **Columnas:** `id`, `name`, `barcode`, `price` (NUMERIC 12,2), `cost` (NUMERIC 10,2, default 0), `stock` (INTEGER), `min_stock`, `category`, `active`, `stock_disabled`, `allow_negative_stock`, `empresa_id`
- **RLS:** Usuarios autenticados de la empresa pueden ver; admin/supervisor gestionan.
- **Triggers:**
  - `sync_stock_from_batches()` — sincroniza stock desde lotes activos.
  - `update_product_cost_from_batches()` — calcula costo promedio ponderado: `SUM(qty*cost)/SUM(qty)` de lotes activos.

#### `product_batches`
- **Propósito:** Lotes de productos con trazabilidad FIFO.
- **Columnas:** `id`, `product_id` (FK products), `empresa_id`, `supplier_id` (FK suppliers), `batch_number`, `quantity`, `initial_quantity`, `cost`, `expiration_date`, `status` (active/depleted), `location`, `notes`, `created_by`, `received_at`
- **RLS:** Usuarios de la empresa ven; admin/supervisor/repositor gestionan.
- **Triggers en esta tabla disparan:** `sync_stock_from_batches()` y `update_product_cost_from_batches()` en productos.

#### `product_stock_balance`
- **Propósito:** Balance consolidado de stock por producto.
- **Columnas:** `id`, `product_id` (UNIQUE FK), `current_balance`, `last_movement_at`, `empresa_id`
- **Trigger:** `update_stock_balance()` — se dispara desde stock_movements.

#### `sales`
- **Propósito:** Ventas registradas.
- **Columnas:** `id`, `sale_number` (auto-increment por empresa via trigger `assign_sale_number_per_empresa()`), `cashier_id`, `customer_id` (FK customers), `customer_name`, `total`, `payment_method` (cash/card/credit/mixed), `cash_amount`, `card_amount`, `credit_amount`, `status` (completed/cancelled/edited), `cash_register_session_id`, `replaces_sale_id`, `notes`, `empresa_id`
- **RLS:** Cajeros ven sus ventas; admin/supervisor ven todas; super_admin acceso total.

#### `sale_items`
- **Propósito:** Items de cada venta.
- **Columnas:** `id`, `sale_id` (FK sales), `product_id` (FK products), `product_name`, `quantity` (NUMERIC para pesables), `unit_price`, `subtotal`, `empresa_id`
- **RLS:** Cajero+ insertan; admin/supervisor editan/eliminan.

#### `customers`
- **Propósito:** Clientes con sistema de crédito.
- **Columnas:** `id`, `name`, `last_name`, `document`, `rut`, `phone`, `address`, `credit_limit`, `current_balance` (sincronizado por trigger), `status`, `notes`, `empresa_id`
- **Trigger:** `sync_customer_balance()` — recalcula current_balance desde credits activos.

#### `credits`
- **Propósito:** Créditos/fiados de clientes.
- **Columnas:** `id`, `customer_id`, `customer_name`, `customer_phone`, `sale_id` (FK sales), `total_amount`, `balance`, `paid_amount`, `status` (pending/partial/paid), `due_date`, `empresa_id`

#### `credit_payments`
- **Propósito:** Pagos parciales/totales de créditos.
- **Columnas:** `id`, `credit_id` (FK credits), `customer_id`, `amount`, `payment_method`, `payment_group_id`, `received_by`, `notes`, `empresa_id`

#### `suppliers`
- **Propósito:** Proveedores.
- **Columnas:** `id`, `name`, `tax_id`, `phone`, `email`, `notes`, `is_active`, `empresa_id`
- **RLS:** Admin gestiona; supervisor inserta/actualiza; todos ven.

#### `expenses`
- **Propósito:** Gastos generales y vinculados a órdenes de compra.
- **Columnas:** `id`, `supplier_id` (FK suppliers), `amount`, `payment_method`, `payment_status` (paid/pending), `expense_date`, `invoice_number`, `notes`, `receipt_url`, `created_by`, `empresa_id`
- **RLS:** Admin/supervisor gestionan; cajero inserta; todos ven.

#### `purchase_orders`
- **Propósito:** Órdenes de compra a proveedores.
- **Columnas:** `id`, `empresa_id`, `supplier_id` (FK suppliers), `order_number` (auto-increment), `order_date`, `total`, `status` (pending/received), `notes`, `created_by`
- **RLS:** Admin/supervisor insertan y actualizan; todos ven. **No hay DELETE policy.**

#### `purchase_order_items`
- **Propósito:** Items de órdenes de compra.
- **Columnas:** `id`, `purchase_order_id` (FK purchase_orders), `product_id` (FK products), `product_name`, `quantity`, `unit_cost`, `subtotal` (columna GENERATED — no incluir en INSERT), `expiration_date`
- **RLS:** SELECT/INSERT/DELETE vía join a purchase_orders. **No hay UPDATE policy.**

#### `cash_registers`
- **Propósito:** Cajas físicas (puntos de cobro).
- **Columnas:** `id`, `name`, `location`, `is_active`, `empresa_id`

#### `cash_register` / `cash_register_sessions`
- **Propósito:** Sesiones de caja (apertura/cierre). Dos tablas con estructura idéntica (legacy + nueva).
- **Columnas clave:** `cashier_id`, `cash_register_id`, `opening_amount`, `closing_amount`, `expected_amount`, `difference`, `difference_reason`, `cash_denominations` (JSONB), `card_total`, `credit_sales_total`, `cash_withdrawals`, `other_expenses`, `ticket_count`, `status` (open/closed), `closure_type` (X/Z), `requires_supervisor_approval`, `supervisor_id`, `supervisor_approved_at`, `pdf_url`, `print_type`

#### `cash_register_expenses`
- **Propósito:** Gastos/retiros registrados durante sesión de caja.
- **Columnas:** `id`, `cash_register_id` (FK cash_register), `amount`, `description`, `category`, `created_by`, `empresa_id`

#### `cash_register_audit`
- **Propósito:** Auditoría de acciones sobre cajas.
- **Columnas:** `id`, `cash_register_id`, `action`, `performed_by`, `details` (JSONB), `empresa_id`

#### `cash_register_takeover_audit`
- **Propósito:** Auditoría de traspasos de caja entre cajeros.
- **Columnas:** `id`, `cash_register_id`, `previous_cashier_id`, `new_cashier_id`, `takeover_amount`, `notes`, `empresa_id`

#### `stock_movements`
- **Propósito:** Historial de movimientos de stock.
- **Columnas:** `id`, `product_id`, `movement_type` (sale/sale_edit/sale_edit_return/return/loss/adjustment/purchase), `quantity`, `previous_stock`, `new_stock`, `reference_id`, `performed_by`, `authorized_by`, `reason`, `override_reason`, `notes`, `empresa_id`

#### `stock_override_audit`
- **Propósito:** Auditoría de overrides de stock (ventas que exceden stock).
- **Columnas:** `id`, `product_id`, `sale_id`, `authorized_by`, `requested_by`, `quantity`, `stock_before`, `stock_after`, `reason`, `empresa_id`

#### `returns`
- **Propósito:** Devoluciones y mermas.
- **Columnas:** `id`, `product_id`, `product_name`, `quantity`, `return_type` (return/loss), `reason`, `refund_amount`, `refund_method`, `related_sale_id`, `customer_id`, `performed_by`, `authorized_by`, `cash_register_session_id`, `notes`, `empresa_id`

#### `notifications`
- **Propósito:** Sistema de notificaciones internas.
- **Columnas:** `id`, `user_id`, `title`, `message`, `type`, `severity`, `read`, `read_by` (array UUID), `archived`, `actor_user_id`, `actor_role`, `target_type`, `target_id`, `related_sale_id`, `related_customer_id`, `metadata` (JSONB), `empresa_id`

#### `notification_audit`
- **Propósito:** Auditoría de acciones sobre notificaciones.

#### `company_settings`
- **Propósito:** Configuración por empresa.
- **Columnas:** `id`, `empresa_id`, `company_name`, `address`, `city`, `phone`, `email`, `tax_id`, `currency` (default CLP), `receipt_footer`, `logo_url`, `stock_disabled`, `cash_closure_approval_threshold` (default 50), `modo_control_stock` (perpetuo/periodico)

#### `inventory_counts`
- **Propósito:** Conteos de inventario.
- **Columnas:** `id`, `product_id`, `qty_counted`, `counted_at`, `counted_by`, `source` (manual/auto), `notes`, `empresa_id`

#### `price_override_logs`
- **Propósito:** Registro de cambios de precio durante ventas.
- **Columnas:** `id`, `sale_id`, `product_id`, `user_id`, `original_price`, `new_price`, `empresa_id`

#### `supervisor_authorizations`
- **Propósito:** Autorizaciones de supervisor (ej: venta sin stock).
- **Columnas:** `id`, `sale_id`, `product_id`, `authorized_by`, `quantity`, `reason`, `empresa_id`

#### `sale_print_audit`
- **Propósito:** Auditoría de impresiones de tickets.

#### `pending_sales`
- **Propósito:** Ventas en espera/pausadas por cajero.
- **Columnas:** `id`, `cashier_id`, `items` (JSONB), `total`, `customer_id`, `customer_name`, `notes`, `empresa_id`

#### `role_assignment_logs`
- **Propósito:** Historial de asignaciones de roles.

### 1.2 Vistas

#### `products_expiring_soon`
- **Propósito:** Productos con lotes próximos a vencer.
- **Columnas:** `product_id`, `product_name`, `barcode`, `batch_id`, `batch_number`, `expiration_date`, `days_until_expiry`, `quantity`, `empresa_id`

#### `v_cash_registers_status`
- **Propósito:** Estado actual de cajas (ocupada/libre).

### 1.3 Funciones de base de datos

| Función | Propósito |
|---------|-----------|
| `has_role(uuid, app_role)` | Verifica si usuario tiene rol específico (SECURITY DEFINER) |
| `has_any_role(uuid, app_role[])` | Verifica si usuario tiene alguno de los roles |
| `get_user_empresa_id(uuid)` | Obtiene empresa_id del usuario |
| `get_admin_user_ids()` | Retorna array de user_ids con rol admin |
| `get_admin_and_supervisor_user_ids()` | Retorna array de admin + supervisor user_ids |
| `handle_new_user()` | Trigger: crea perfil al registrarse usuario |
| `assign_sale_number_per_empresa()` | Trigger: asigna sale_number secuencial por empresa |
| `process_sale_with_movements(jsonb, jsonb, jsonb)` | Procesa venta completa: inserta sale, items, descuenta stock, registra movimientos |
| `update_sale_items(uuid, jsonb, uuid)` | Edita items de venta existente con reconciliación de stock |
| `sync_stock_from_batches()` | Trigger: sincroniza products.stock desde lotes activos |
| `update_product_cost_from_batches()` | Trigger: calcula costo promedio ponderado desde lotes |
| `update_stock_balance()` | Trigger: actualiza product_stock_balance desde stock_movements |
| `sync_customer_balance()` | Trigger: recalcula customers.current_balance desde credits |
| `create_customer_with_initial_debt(...)` | Crea cliente con deuda inicial (sale + credit) |
| `update_updated_at()` | Trigger genérico para updated_at |
| `get_cash_registers_status(uuid?)` | Retorna estado de cajas con sesión abierta |

### 1.4 Enum `app_role`
Valores: `admin`, `supervisor`, `cajero`, `repositor`, `super_admin`

---

## 2. COMPONENTES FRONTEND

### 2.1 Páginas (`src/pages/`)

| Página | Ruta | Propósito | Guard |
|--------|------|-----------|-------|
| `Auth` | `/auth` | Login/registro | — |
| `Dashboard` | `/dashboard` | KPIs, gráficos, alertas | — |
| `POS` | `/pos` | Punto de venta | GlobalModeGuard |
| `Products` | `/products` | CRUD productos, lotes, códigos de barras | GlobalModeGuard |
| `Customers` | `/customers` | Gestión de clientes y créditos | GlobalModeGuard |
| `Sales` | `/sales` | Historial de ventas, edición, reimpresión | — |
| `CashClosure` | `/cash-closure` | Apertura/cierre de caja (wizard 5 pasos) | GlobalModeGuard |
| `CashClosureHistory` | `/cash-closure-history` | Historial de cierres | — |
| `ExpensesManagement` | `/admin/gastos` | Gastos, proveedores, órdenes de compra | GlobalModeGuard |
| `Settings` | `/settings` | Configuración: empresa, usuarios, cajas, sistema | GlobalModeGuard |
| `Empresas` | `/empresas` | Gestión multi-empresa (super_admin) | — |
| `Planes` | `/planes` | Gestión de planes (super_admin) | — |
| `BackupRestore` | `/admin/respaldos` | Exportar/importar datos | GlobalModeGuard |
| `NotFound` | `*` | 404 | — |

### 2.2 Componentes principales (`src/components/`)

#### Layout y navegación
- `MainLayout` — Layout principal con sidebar, bottom nav, notification bell
- `AppSidebar` — Sidebar de navegación con secciones por rol
- `BottomNav` — Navegación móvil inferior
- `GlobalModeBanner` — Banner que indica modo global (multi-empresa)
- `GlobalModeGuard` — Bloquea escritura en modo global
- `EmpresaSelector` — Selector de empresa (super_admin)
- `ThemeToggle` — Toggle dark/light mode
- `UpdatePrompt` — Prompt de actualización PWA

#### Autenticación
- `AuthForm` — Formulario de login/registro con email+password

#### Dashboard
- `KPICards` — Tarjetas de KPIs (ventas, clientes, productos)
- `SalesCharts` — Gráficos de ventas (Recharts)
- `ActionableLists` — Listas de acciones pendientes
- `CashRegistersStatus` — Estado de cajas en dashboard
- `DashboardFilters` — Filtros de fecha para dashboard
- `ExpirationAlertBanner` — Alerta de productos por vencer

#### POS
- `ProductSearchAutocomplete` — Búsqueda de productos con autocompletado
- `PaymentModal` — Modal de pago (cash/card/credit/mixed)
- `CashRegisterSelectionModal` — Selección de caja al abrir POS
- `CustomerSelectDialog` — Selección/creación de cliente
- `CustomerActionDialog` — Acciones sobre cliente seleccionado
- `CreditOptionsModal` — Opciones de crédito (plazo, monto)
- `DebtPaymentModal` — Pago de deudas desde POS
- `PendingSalesDrawer` — Drawer de ventas en espera
- `CashExpenseDialog` — Registro de gasto desde caja
- `ExpenseTypeDialog` — Selección de tipo de gasto
- `GenericProductDialog` — Producto genérico (sin código)
- `ReturnsAndLossesDialog` — Devoluciones y mermas
- `SupervisorPinDialog` — PIN de supervisor para autorizaciones

#### Productos
- `BarcodeDialog` — Generador/visor de códigos de barras (JsBarcode)
- `ProductBatchesDialog` — Gestión de lotes por producto

#### Ventas
- `SaleDetailDialog` — Detalle de venta con edición de items
- `SalesFilters` — Filtros de ventas (fecha, método de pago, estado)

#### Gastos
- `ExpensesTab` / `ExpensesTable` — Tabla de gastos con filtros
- `ExpenseDialog` — CRUD de gastos individuales
- `ExpenseFilters` — Filtros de gastos
- `SuppliersTab` / `SuppliersTable` — Tabla de proveedores
- `SupplierDialog` — CRUD de proveedores
- `PurchaseOrdersTab` — Tabla de órdenes de compra
- `PurchaseOrderDialog` — Creación/edición de órdenes de compra (crea lotes, gasto vinculado, actualiza stock)
- `ReceiptPreviewDialog` — Vista previa de comprobantes

#### Cierre de caja
- `CashOpenStep` — Paso de apertura de caja
- `CashClosureStep1` a `CashClosureStep5` — Wizard de cierre (conteo, resumen, diferencia, aprobación, confirmación)

#### Configuración
- `CompanyTab` — Configuración de empresa
- `UsersTab` — Gestión de usuarios
- `CashRegistersTab` — Gestión de cajas físicas
- `SystemTab` — Configuración del sistema
- `CompanySettingsForm` — Formulario de configuración de empresa

#### Usuarios
- `CreateUserDialog` — Creación de usuario (via edge function)
- `UserEditPanel` — Edición de usuario
- `UserAuditDialog` — Auditoría de acciones del usuario

#### Multi-empresa
- `EmpresaDialog` — CRUD de empresas
- `AssignAdminDialog` — Asignación de admin a empresa

#### Planes
- `PlanCard` — Tarjeta visual de plan
- `PlanDialog` — CRUD de planes

#### Notificaciones
- `NotificationBell` — Campana con badge de no leídas
- `AdminNotificationCenter` — Panel de notificaciones admin

#### Backup
- `ExportSection` — Exportación de datos
- `ImportSection` — Importación de datos
- `ColumnPreview` — Preview de columnas al importar

### 2.3 Hooks (`src/hooks/`)

| Hook | Propósito |
|------|-----------|
| `useAuth` | Autenticación: session, user, role, signIn, signOut, loading |
| `useEmpresaId` | Obtiene empresa_id del usuario actual |
| `useGlobalMode` | Detecta modo global (super_admin viendo todas las empresas) |
| `useDashboardData` | Datos agregados para dashboard (ventas, KPIs) |
| `useNotifications` | CRUD de notificaciones con realtime |
| `useProductExpiration` | Productos próximos a vencer |
| `usePlanLimits` | Límites del plan actual de la empresa |
| `useUserNavigation` | Navegación contextual por rol |
| `use-mobile` | Detección de viewport mobile |
| `use-toast` | Sistema de toast notifications |

### 2.4 Contextos

- `EmpresaContext` — Provee empresa_id seleccionada y setter global

### 2.5 Utilidades (`src/lib/`)

| Archivo | Propósito |
|---------|-----------|
| `pdfGenerator.ts` | Generación de PDF de cierre de caja (jsPDF) |
| `pdfSaleGenerator.ts` | Generación de ticket de venta (jsPDF) |
| `pdfDebtPaymentGenerator.ts` | Generación de comprobante de pago de deuda |
| `silentPrint.ts` | Impresión silenciosa de tickets |
| `utils.ts` | Utilidades generales (cn, formatCurrency, etc.) |

---

## 3. FLUJOS DE NEGOCIO IMPLEMENTADOS

### 3.1 Flujo de venta completa
1. Cajero abre sesión de caja (selecciona caja física, ingresa monto inicial)
2. Busca productos por nombre/código de barras
3. Agrega items al carrito (cantidad, precio editable con autorización)
4. Selecciona método de pago (cash/card/credit/mixed)
5. Si crédito: selecciona/crea cliente, verifica límite de crédito
6. `process_sale_with_movements()` ejecuta atómicamente: inserta venta, items, descuenta stock (FIFO de lotes), registra movimientos
7. Genera e imprime ticket (PDF o impresión silenciosa)
8. Si crédito: crea registro en credits vinculado a la venta

### 3.2 Flujo de cierre de caja
1. Cajero inicia cierre (tipo X parcial o Z final)
2. Ingresa conteo de billetes/monedas por denominación
3. Sistema calcula expected_amount (apertura + ventas cash - retiros - gastos)
4. Calcula diferencia (conteo real vs esperado)
5. Si diferencia > umbral: requiere aprobación de supervisor
6. Genera PDF de cierre con detalle completo
7. Cierra sesión de caja

### 3.3 Flujo de orden de compra
1. Admin/supervisor crea orden seleccionando proveedor y productos
2. Sistema crea: purchase_order, purchase_order_items, product_batches (lotes), expense vinculado
3. Triggers actualizan automáticamente: products.stock (desde lotes), products.cost (promedio ponderado)
4. Al editar: verifica que no haya lotes parcialmente consumidos antes de permitir cambios

### 3.4 Flujo de devolución/merma
1. Desde POS: registra devolución o merma con motivo
2. Si devolución: puede reembolsar en cash/card/crédito
3. Registra en tabla returns con referencia a venta original
4. Ajusta stock del producto

### 3.5 Flujo de crédito y cobranza
1. Venta a crédito crea registro en credits
2. Cliente acumula balance (sync_customer_balance trigger)
3. Desde POS o gestión: registra pagos parciales/totales
4. credit_payments actualiza balance y status del crédito
5. Genera comprobante PDF de pago

### 3.6 Flujo de gestión de usuarios
1. Admin crea usuario via edge function `create-user` (bypassa auth normal)
2. Asigna rol (admin/supervisor/cajero/repositor)
3. Configura permisos (can_edit_price, PIN de supervisor)
4. Puede desactivar, editar credenciales o eliminar via edge functions

### 3.7 Flujo de backup/restore
1. Exporta datos seleccionados via edge function `backup-restore-data`
2. Genera JSON/CSV descargable
3. Importa datos via edge function con validación de columnas

---

## 4. BUGS CONOCIDOS Y PENDIENTES

### 4.1 Problemas identificados
1. **Tabla cash_register duplicada:** Existen `cash_register` y `cash_register_sessions` con estructura idéntica. Ambas se usan en distintas partes del código. Debería consolidarse.
2. **purchase_order_items sin UPDATE policy:** No se puede actualizar items individualmente — el workaround actual es DELETE + INSERT.
3. **purchase_orders sin DELETE policy:** No se pueden eliminar órdenes de compra.
4. **empresa_id hardcodeado como default:** Varias tablas tienen `DEFAULT '85923e8e-7241-470f-94e3-7ff1d544a2d4'::uuid` — funciona para single-tenant pero es problemático en multi-tenant real.
5. **`products_expiring_soon` view:** La definición está truncada en types.ts — verificar que funciona correctamente.

### 4.2 Deuda técnica
- `PurchaseOrderDialog.tsx` (464 líneas) — debería refactorizarse en componentes más pequeños.
- `Products.tsx` — archivo de página muy extenso, mezcla lógica de negocio con UI.
- `POS.tsx` — probablemente el archivo más grande, concentra toda la lógica del punto de venta.
- Algunas migraciones tempranas son redundantes (múltiples intentos de importación de productos).

---

## 5. EDGE FUNCTIONS

| Función | Propósito | Estado |
|---------|-----------|--------|
| `create-user` | Crear usuario via service_role (bypassa auth normal). Recibe email, password, full_name, role, empresa_id. | ✅ Activa |
| `delete-user` | Eliminar usuario de auth.users. Recibe userId. | ✅ Activa |
| `update-user-credentials` | Actualizar email/password de usuario. Recibe userId, newEmail?, newPassword?. | ✅ Activa |
| `bootstrap-super-admin` | Asignar rol super_admin a un usuario específico. | ✅ Activa |
| `import-products` | Importar productos masivamente desde JSON/CSV. | ✅ Activa |
| `upsert-products` | Upsert de productos (crear o actualizar). | ✅ Activa |
| `cleanup-products` | Limpiar productos duplicados o inválidos. | ✅ Activa |
| `cleanup-duplicate-sales` | Limpiar ventas duplicadas. | ✅ Activa |
| `cleanup-test-data` | Limpiar datos de prueba. | ✅ Activa |
| `backup-restore-data` | Exportar/importar datos completos de la empresa. | ✅ Activa |

Todas usan `@supabase/supabase-js@2`, CORS headers estándar, y `SUPABASE_SERVICE_ROLE_KEY` para operaciones admin.

---

## 6. MIGRACIONES APLICADAS (cronológico)

| Fecha | Descripción |
|-------|-------------|
| 2025-10-28 | Setup inicial: enum app_role, profiles, user_roles, products, sales, sale_items, cash_register, stock_movements, notifications. Importación masiva de productos. |
| 2025-10-28 | Crear customers table. Ajustes numéricos (numeric 12,2). Limpieza de duplicados. |
| 2025-10-28 | Crear notifications table con campos extendidos. |
| 2025-10-29 | Company_settings table. Campos adicionales en profiles (email, pin). |
| 2025-10-29 | Extender cash_register para cierre inteligente. |
| 2025-10-30 | Cash_registers (cajas físicas). Sesiones únicas por caja. Vista v_cash_registers_status. |
| 2025-10-30 | allow_negative_stock en products. Función process_sale_stock mejorada. |
| 2025-10-31 | Renombrar allow_negative_stock → stock_disabled. |
| 2025-11-01 | Limpiar funciones obsoletas. |
| 2025-11-04 | Actualizar process_sale_with_movements para stock_disabled. |
| 2025-11-06 | Tabla returns (devoluciones/mermas). |
| 2025-11-07 | Campo can_edit_price en profiles. |
| 2025-11-08 | stock_disabled default true para productos existentes. |
| 2025-11-10 | print_type en cash_register. |
| 2025-11-11 | Ampliar notifications con severity, actor, target, metadata. |
| 2025-11-12 | Función get_admin_user_ids (security definer). |
| 2025-11-13 | Tabla sale_print_audit. |
| 2025-11-26 | quantity de integer a numeric en sale_items (productos pesables). |
| 2025-12-02 | Tabla product_batches (lotes). Función FIFO en process_sale_with_movements. |
| 2025-12-13 | Bucket company-assets para logos. |
| 2025-12-15 | Campo city en company_settings. cash_register_session_id en sales. |
| 2025-12-16 | Tabla suppliers. Campo rut en customers. |
| 2025-12-16 | Función create_customer_with_initial_debt. |
| 2025-12-27 | Ajustar RLS de expenses. |
| 2025-12-31 | Campos last_name, address en customers. |
| 2026-01-07 | cash_closure_approval_threshold en company_settings. |
| 2026-01-13 | Asignar rol admin a usuario soporte. |
| 2026-01-20 | Migraciones de ajuste (contenido no disponible). |
| 2026-02-02 | Función create_customer_with_initial_debt mejorada. Email en profiles. cash_register_session_id en sales. Bucket company-assets. |
| 2026-02-03 | FK credits.sale_id → sales.id. Umbral de aprobación en cierre. |
| 2026-02-14 | Migraciones de ajuste multi-empresa. |
| 2026-02-16 | Location en product_batches. Ajustes en sale_items y credit_payments. |
| 2026-02-17 | Migraciones de ajuste. |
| 2026-02-21 | Migraciones de ajuste. |
| 2026-02-26 | customer_id en pending_sales. replaces_sale_id en sales. |
| 2026-02-28 | override_reason en stock_movements. |
| 2026-03-01 | Limpieza de datos específicos. |
| 2026-03-10 | Múltiples migraciones de ajuste (8 archivos). |
| 2026-03-14 | Múltiples migraciones de ajuste (6 archivos). |
| 2026-03-15 | Migraciones de ajuste (3 archivos). |
| 2026-03-23 | Ajustes de RLS y estructura. |
| 2026-03-24 | Órdenes de compra: tablas purchase_orders, purchase_order_items. RLS policies. |
| 2026-03-26 | DELETE policy en purchase_order_items. Trigger update_product_cost_from_batches (costo promedio ponderado). |

**Total: 109 migraciones aplicadas.**

---

## 7. VARIABLES DE ENTORNO Y CONFIGURACIÓN

### Variables en `.env` (auto-generadas, NO editar):
- `VITE_SUPABASE_URL` — URL del proyecto backend
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Clave pública (anon key)
- `VITE_SUPABASE_PROJECT_ID` — ID del proyecto

### Secrets configurados en edge functions:
- `SUPABASE_URL` — URL interna
- `SUPABASE_ANON_KEY` — Clave anónima
- `SUPABASE_SERVICE_ROLE_KEY` — Clave de servicio (admin)
- `SUPABASE_DB_URL` — URL de conexión directa a DB
- `SUPABASE_PUBLISHABLE_KEY` — Clave pública
- `LOVABLE_API_KEY` — API key de Lovable (para AI features)

### Configuración técnica:
- **Framework:** React 18 + Vite 5 + TypeScript
- **Styling:** Tailwind CSS 3 + shadcn/ui + tailwindcss-animate
- **State:** React Query (TanStack) + Context API
- **Routing:** React Router DOM 6
- **Charts:** Recharts
- **PDF:** jsPDF
- **Barcode:** JsBarcode
- **PWA:** vite-plugin-pwa
- **Theme:** next-themes (dark/light)
- **Storage buckets:** `expense-receipts` (público), `company-assets` (público)

---

## 8. PENDIENTES FUTUROS

### 8.1 Features planificadas no implementadas
1. **AI Asistente** — Campo en planes pero sin implementación frontend
2. **WhatsApp respuestas** — Campo en planes pero sin implementación
3. **Multi-sucursal** — `max_sucursales` en planes pero sin modelo de sucursales
4. **Conteo de inventario periódico** — Tabla `inventory_counts` existe pero sin UI completa de workflow
5. **Reportes avanzados** — Solo dashboard básico, sin exportación de reportes
6. **Facturación electrónica** — Sin integración con sistemas fiscales
7. **Integración con medios de pago** — Sin procesamiento real de tarjetas

### 8.2 Mejoras técnicas pendientes
1. Consolidar `cash_register` y `cash_register_sessions` en una sola tabla
2. Refactorizar componentes grandes (POS, Products, PurchaseOrderDialog)
3. Eliminar default hardcodeado de empresa_id en tablas
4. Agregar UPDATE policy a purchase_order_items
5. Agregar DELETE policy a purchase_orders
6. Implementar tests unitarios y de integración
7. Optimizar queries N+1 en flujos de stock
8. Implementar rate limiting en edge functions

---

## 9. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────┐
│           Frontend (React/Vite)          │
│  ┌─────────┐ ┌──────┐ ┌──────────────┐ │
│  │  Pages   │ │Hooks │ │  Components  │ │
│  └────┬─────┘ └──┬───┘ └──────┬───────┘ │
│       └──────────┼────────────┘         │
│                  │                       │
│       ┌──────────▼───────────┐          │
│       │  Supabase JS Client  │          │
│       └──────────┬───────────┘          │
└──────────────────┼───────────────────────┘
                   │ HTTPS
┌──────────────────┼───────────────────────┐
│          Supabase Backend                │
│  ┌───────────────▼──────────────┐       │
│  │         PostgREST API        │       │
│  └───────────────┬──────────────┘       │
│  ┌───────────────▼──────────────┐       │
│  │      PostgreSQL Database     │       │
│  │  ┌─────────┐ ┌────────────┐  │       │
│  │  │ Tables  │ │ Functions  │  │       │
│  │  │ + RLS   │ │ + Triggers │  │       │
│  │  └─────────┘ └────────────┘  │       │
│  └──────────────────────────────┘       │
│  ┌──────────────────────────────┐       │
│  │       Edge Functions         │       │
│  │  (Deno, service_role key)    │       │
│  └──────────────────────────────┘       │
│  ┌──────────────────────────────┐       │
│  │       Storage Buckets        │       │
│  └──────────────────────────────┘       │
│  ┌──────────────────────────────┐       │
│  │       Auth (GoTrue)          │       │
│  └──────────────────────────────┘       │
└──────────────────────────────────────────┘
```

### Patrón de seguridad multi-tenant:
1. Cada tabla tiene `empresa_id`
2. RLS policies verifican `empresa_id = get_user_empresa_id(auth.uid())`
3. Roles verificados via `has_role()` / `has_any_role()` (SECURITY DEFINER)
4. Super_admin bypassa todas las restricciones de empresa
5. Edge functions usan service_role key para operaciones admin

### Patrón de control de stock:
1. **Lotes (product_batches):** Fuente de verdad para stock y costo
2. **Trigger sync_stock_from_batches:** Mantiene products.stock sincronizado
3. **Trigger update_product_cost_from_batches:** Mantiene products.cost como promedio ponderado
4. **FIFO en ventas:** process_sale_with_movements descuenta de lotes más antiguos primero
5. **stock_movements:** Registro inmutable de todos los cambios de stock
