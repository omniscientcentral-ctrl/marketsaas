import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ShoppingCart,
  Trash2,
  Clock,
  User,
  LogOut,
  Calendar,
  ArrowLeft,
  DollarSign,
  Store,
  PackageMinus,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PaymentModal from "@/components/pos/PaymentModal";
import CustomerSelectDialog from "@/components/pos/CustomerSelectDialog";
import CustomerActionDialog from "@/components/pos/CustomerActionDialog";
import CreditOptionsModal from "@/components/pos/CreditOptionsModal";
import DebtPaymentModal from "@/components/pos/DebtPaymentModal";
import PendingSalesDrawer from "@/components/pos/PendingSalesDrawer";
import ProductSearchAutocomplete from "@/components/pos/ProductSearchAutocomplete";
import CashRegisterSelectionModal from "@/components/pos/CashRegisterSelectionModal";
import SupervisorPinDialog from "@/components/pos/SupervisorPinDialog";
import { ReturnsAndLossesDialog } from "@/components/pos/ReturnsAndLossesDialog";
import ExpenseDialog from "@/components/expenses/ExpenseDialog";
import ExpenseTypeDialog from "@/components/pos/ExpenseTypeDialog";
import CashExpenseDialog from "@/components/pos/CashExpenseDialog";
import type { Supplier } from "@/components/expenses/ExpensesTab";
import GenericProductDialog from "@/components/pos/GenericProductDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import MainLayout from "@/components/layout/MainLayout";
import { SidebarTrigger } from "@/components/ui/sidebar";

import type { CartItem, Customer } from "@/hooks/usePOSTypes";
import { usePOSCart } from "@/hooks/usePOSCart";
import { usePOSSession } from "@/hooks/usePOSSession";
import { usePOSCustomer } from "@/hooks/usePOSCustomer";
import { usePOSRedoSale } from "@/hooks/usePOSRedoSale";
import { usePOSSale } from "@/hooks/usePOSSale";

const POS = () => {
  const { user, loading, activeRole } = useAuth();
  const empresaId = useEmpresaId();
  const navigate = useNavigate();

  // ── Cart ──────────────────────────────────────────────────────────────────
  const {
    cart,
    setCart,
    canEditPrice,
    quantityInputs,
    addToCart,
    removeFromCart,
    updateQuantity,
    handleQuantityInputChange,
    commitQuantityInput,
    updatePrice,
    addGenericProduct,
    clearCart: clearCartItems,
    getSubtotal,
    getTotal,
    getTotalItems,
  } = usePOSCart(user?.id, activeRole);

  // ── Cash register session ─────────────────────────────────────────────────
  const {
    currentSession,
    sessionLoading,
    setSessionLoading,
    showCashRegisterModal,
    setShowCashRegisterModal,
    checkCashRegisterSession,
    handleSessionSelected,
    handleChangeCashRegister,
    loadCompanySettings,
  } = usePOSSession(user?.id);

  // ── Customer ──────────────────────────────────────────────────────────────
  const { selectedCustomer, setSelectedCustomer, tempCustomer, setTempCustomer } = usePOSCustomer();

  // Declared before usePOSSale so its setter is in scope for onCompleteSale
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ── Redo sale ─────────────────────────────────────────────────────────────
  const {
    originalSaleId,
    originalSaleNumber,
    setOriginalSaleId,
    setOriginalSaleNumber,
    cancelOriginalSale,
  } = usePOSRedoSale(setCart, setSelectedCustomer, user?.id);

  // ── Sale processing ───────────────────────────────────────────────────────
  const {
    isProcessingSaleRef,
    calculateAvailableCredit,
    notifyAdminsAboutCreditExcess,
    printCreditReceipt,
    completeSale,
    completeSaleForCustomer,
  } = usePOSSale({
    cart,
    selectedCustomer,
    currentSession,
    empresaId,
    user,
    originalSaleId,
    originalSaleNumber,
    cancelOriginalSale,
    setCart,
    setSelectedCustomer,
    onCompleteSale: () => setShowPaymentModal(false),
  });

  // ── Remaining local state ─────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showCustomerAction, setShowCustomerAction] = useState(false);
  const [showDebtPayment, setShowDebtPayment] = useState(false);
  const [debtPaymentMode, setDebtPaymentMode] = useState<"partial" | "total">("total");
  const [showPendingSales, setShowPendingSales] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [showReturnsDialog, setShowReturnsDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showExpenseTypeDialog, setShowExpenseTypeDialog] = useState(false);
  const [showCashExpenseDialog, setShowCashExpenseDialog] = useState(false);
  const [showGenericProduct, setShowGenericProduct] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<(() => void) | null>(null);
  const [productsRequiringAuth, setProductsRequiringAuth] = useState<CartItem[]>([]);

  const { notifySupervisorOverride } = useNotifications();

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Auth guard + initialization ───────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    const allowedRoles = ["admin", "supervisor", "cajero", "super_admin"];
    if (!loading && activeRole && !allowedRoles.includes(activeRole)) {
      toast.error("No tenés permisos para acceder al POS");
      navigate("/dashboard");
      return;
    }
    // Si auth terminó y no hay activeRole, no quedarse cargando
    if (!loading && user && !activeRole) {
      setSessionLoading(false);
      return;
    }

    if (user && activeRole) {
      checkCashRegisterSession();
      fetchPendingSalesCount();
      loadCompanySettings();
    }
  }, [user, loading, activeRole, navigate]);

  // ── Suppliers for ExpenseDialog ───────────────────────────────────────────
  useEffect(() => {
    const fetchSuppliers = async () => {
      let query = supabase.from("suppliers").select("id, name, tax_id, phone, email, notes, is_active").eq("is_active", true);
      if (empresaId) query = query.eq("empresa_id", empresaId);
      const { data } = await query.order("name");
      if (data) setSuppliers(data as Supplier[]);
    };
    if (user) fetchSuppliers();
  }, [user, empresaId]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      } else if (e.key === "F5") {
        e.preventDefault();
        setShowCustomerDialog(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        setShowPendingSales(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        savePendingSale();
      } else if (e.key === "F8") {
        e.preventDefault();
        setShowGenericProduct(true);
      } else if (e.key === "F12") {
        e.preventDefault();
        handleF12Cobrar();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPaymentModal(false);
        setShowCustomerDialog(false);
        setShowCustomerAction(false);
        setShowDebtPayment(false);
        setShowPendingSales(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedCustomer]);

  // ── Helper functions ──────────────────────────────────────────────────────
  const fetchPendingSalesCount = async () => {
    try {
      const { count, error } = await supabase
        .from("pending_sales")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("cashier_id", user?.id);
      if (error) throw error;
      setPendingSalesCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching pending sales count:", error.message);
    }
  };

  const handleStartCashClosure = async () => {
    if (!currentSession) {
      toast.error("No tenés una caja abierta");
      return;
    }
    navigate("/cash-closure");
  };

  // Clears cart and deselects customer (wrapper that combines both hook actions)
  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("¿Vaciar el carrito?")) {
      clearCartItems();
      setSelectedCustomer(null);
    }
  };

  const savePendingSale = async () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    try {
      const { error } = await supabase.from("pending_sales").insert([
        {
          cashier_id: user?.id,
          empresa_id: empresaId,
          customer_name: selectedCustomer?.name || null,
          customer_id: selectedCustomer?.id || null,
          items: cart as any,
          total: getTotal(),
          notes: selectedCustomer ? `Cliente: ${selectedCustomer.name}` : null,
        } as any,
      ]);
      if (error) throw error;
      toast.success("Venta guardada en espera");
      clearCartItems();
      setSelectedCustomer(null);
      fetchPendingSalesCount();
    } catch (error: any) {
      toast.error("Error al guardar venta: " + error.message);
    }
  };

  const loadPendingSale = async (items: CartItem[], customerName: string | null, customerId: string | null) => {
    setCart(items);
    setShowPendingSales(false);
    fetchPendingSalesCount();
    if (customerId || customerName) {
      try {
        let query = supabase.from("customers").select("id, name, last_name, document, phone, address, credit_limit, current_balance, status").eq("status", "active");
        if (customerId) {
          query = query.eq("id", customerId);
        } else {
          query = query.eq("name", customerName!);
        }
        const { data: customer, error } = await query.maybeSingle();
        if (!error && customer) {
          setSelectedCustomer(customer);
          toast.success(`Venta retomada: ${customer.name}`);
        } else {
          toast.success(`Venta retomada (cliente no encontrado: ${customerName || "desconocido"})`);
        }
      } catch (error) {
        toast.success(`Venta retomada`);
      }
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    // Solo seleccionar/asignar cliente, NO abrir acciones
    setSelectedCustomer(customer);
    setTempCustomer(customer);
    setShowCustomerDialog(false);
    toast.success(`Cliente ${customer.name} asignado`);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setShowCustomerDialog(false);
    toast.success("Cliente eliminado");
  };

  // ── Payment flow ──────────────────────────────────────────────────────────
  const handleF12Cobrar = () => {
    // Verificar productos que necesitan autorización (stock_disabled = false y stock negativo)
    const needsAuthorization = cart.some((item) => {
      const stockProyectado = item.product.stock - item.quantity;
      return !item.product.stock_disabled && stockProyectado < 0;
    });

    if (needsAuthorization && cart.length > 0) {
      const productsNeedingAuth = cart.filter((item) => {
        const stockProyectado = item.product.stock - item.quantity;
        return !item.product.stock_disabled && stockProyectado < 0;
      });
      setProductsRequiringAuth(productsNeedingAuth);
      setPendingPaymentAction(() => () => {
        proceedWithPayment();
      });
      setShowSupervisorPin(true);
      return;
    }
    proceedWithPayment();
  };

  const proceedWithPayment = () => {
    // Modo 1: Carrito CON productos → Cobrar venta
    if (cart.length > 0) {
      if (!selectedCustomer) {
        // Sin cliente: modal de pago normal (efectivo/tarjeta/mixto)
        setShowPaymentModal(true);
      } else {
        // Con cliente: abrir menú de opciones de fiado
        setTempCustomer(selectedCustomer);
        setShowCustomerAction(true);
      }
      return;
    }

    // Modo 2: Carrito VACÍO + Cliente seleccionado → Gestionar pago de deuda
    if (selectedCustomer) {
      setTempCustomer(selectedCustomer);
      setDebtPaymentMode("total");
      setShowDebtPayment(true);
      return;
    }

    // Modo 3: Carrito vacío + Sin cliente → No hacer nada (botón deshabilitado)
    toast.error("Selecciona un cliente o agrega productos");
  };

  const handleSupervisorAuthSuccess = async (supervisorName?: string) => {
    // Notificar sobre los overrides autorizados
    if (productsRequiringAuth.length > 0 && supervisorName) {
      for (const item of productsRequiringAuth) {
        await notifySupervisorOverride({
          supervisorName,
          productName: item.product.name,
          quantity: item.quantity,
          reason: `Stock insuficiente: ${item.product.stock} disponibles, solicitados: ${item.quantity}`,
        });
      }
    }
    setProductsRequiringAuth([]);

    if (pendingPaymentAction) {
      pendingPaymentAction();
      setPendingPaymentAction(null);
    }
  };

  const handleFiar = async (ticketType: string = "no_imprimir", showDebt: boolean = true) => {
    if (!tempCustomer) return;
    if (isProcessingSaleRef.current) return;
    isProcessingSaleRef.current = true;
    const total = getTotal();
    const available = await calculateAvailableCredit(tempCustomer);
    const wouldExceed = available < total;

    setShowCustomerAction(false);

    try {
      const saleResult = await completeSaleForCustomer("credit", tempCustomer);

      if (wouldExceed && saleResult?.saleId) {
        const missingAmount = total - available;
        await notifyAdminsAboutCreditExcess(tempCustomer, total, missingAmount, saleResult.saleId);
        toast.success(`Venta fiada (excedió crédito). Se notificó al administrador.`);
      } else {
        toast.success(`Venta a crédito completada para ${tempCustomer.name}`);
      }

      if (saleResult?.saleId && ticketType !== "no_imprimir") {
        await printCreditReceipt(saleResult.saleId, tempCustomer, ticketType, showDebt);
      }

      setSelectedCustomer(null);
      setTempCustomer(null);
    } catch (error: any) {
      toast.error("Error al procesar venta: " + error.message);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };

  const handlePayPartial = () => {
    setDebtPaymentMode("partial");
    setShowCustomerAction(false);
    setShowDebtPayment(true);
  };

  const handlePayTotal = () => {
    setDebtPaymentMode("total");
    setShowCustomerAction(false);
    setShowDebtPayment(true);
  };

  const handleDebtPaymentComplete = async (remainingBalance: number, mode: "partial" | "total") => {
    if (tempCustomer) {
      const updatedCustomer = {
        ...tempCustomer,
        current_balance: remainingBalance,
      };
      setTempCustomer(updatedCustomer);
      if (mode === "partial") {
        const total = getTotal();
        const newAvailable = updatedCustomer.credit_limit - updatedCustomer.current_balance;
        if (newAvailable >= total) {
          setSelectedCustomer(updatedCustomer);
          setShowDebtPayment(false);
          try {
            await completeSale("credit", "tickeadora");
            toast.success(`Pago parcial registrado y venta a crédito completada`);
            setTempCustomer(null);
          } catch (error: any) {
            toast.error("Error al procesar venta: " + error.message);
          }
        } else {
          const faltante = total - newAvailable;
          toast.error(
            `Faltan $${faltante.toFixed(2)} para cubrir el total. Aumenta el pago parcial o cobra contado/mixto.`,
          );
          setShowDebtPayment(false);
          setShowCustomerAction(true);
        }
      } else {
        toast.success("Deuda saldada correctamente");
        setTempCustomer(null);
        setSelectedCustomer(null);
      }
    }
    setShowDebtPayment(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading || sessionLoading) {
    return (
      <MainLayout showBottomNav={false} defaultOpen={false} showMobileHeader={false}>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Cargando POS...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Bloquear POS si no hay sesión seleccionada
  const isPOSBlocked = !currentSession;

  // Determinar el modo del botón F12
  const isDebtPaymentMode = cart.length === 0 && selectedCustomer !== null;
  const isF12Disabled = cart.length === 0 && selectedCustomer === null;
  return (
    <MainLayout showBottomNav={false} defaultOpen={false} showMobileHeader={false}>
      <div className="min-h-screen bg-background">
        {/* Banner de Rehacer venta */}
        {originalSaleId && (
          <div className="bg-primary/15 border-b border-primary/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Rehaciendo venta #{originalSaleNumber} — Al cobrar se anulará la original
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOriginalSaleId(null);
                setOriginalSaleNumber(null);
                setCart([]);
                setSelectedCustomer(null);
                toast.info("Rehacer venta cancelado");
              }}
              className="text-primary hover:text-primary"
            >
              Cancelar
            </Button>
          </div>
        )}
        {/* Header */}
        <header className="border-b bg-card">
          <div className="px-4 py-2 flex items-center justify-between gap-4">
            {/* Sección Izquierda: Sidebar Trigger + Badge Consolidado */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />

              <div className="flex items-center gap-2 bg-primary/15 rounded-lg px-3 py-1.5">
                {/* Usuario */}
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{user?.email?.split("@")[0] || "Usuario"}</span>
                </div>

                <span className="text-primary/50">|</span>

                {/* Fecha */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm">{format(currentTime, "dd/MM/yyyy", { locale: es })}</span>
                </div>

                <span className="text-primary/50">|</span>

                {/* Hora */}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-mono">{format(currentTime, "HH:mm:ss", { locale: es })}</span>
                </div>
              </div>
            </div>

            {/* Sección Central: Botones de Acción */}
            <div className="flex items-center gap-1">
              {/* Botón Ventas en Espera - con badge integrado */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPendingSales(true)}
                disabled={isPOSBlocked}
                className={cn(
                  "transition-colors",
                  pendingSalesCount > 0
                    ? "text-primary bg-primary/10 hover:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
                aria-label={`Ventas en espera: ${pendingSalesCount}`}
              >
                <Clock className="h-4 w-4" />
                {pendingSalesCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs font-semibold">
                    {pendingSalesCount}
                  </Badge>
                )}
                <span className="hidden sm:inline ml-1.5">Ventas en Espera</span>
              </Button>

              {/* Separador vertical sutil */}
              <div className="h-6 w-px bg-border mx-1" />

              {/* Botón Gastos / Retiro de Caja */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExpenseTypeDialog(true)}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                aria-label="Registrar gasto"
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Gastos</span>
              </Button>

              {/* Separador vertical sutil */}
              <div className="h-6 w-px bg-border mx-1" />

              {/* Botón Producto Genérico */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGenericProduct(true)}
                disabled={isPOSBlocked}
                className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                aria-label="Producto genérico (F8)"
              >
                <PackagePlus className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Genérico (F8)</span>
              </Button>

              {/* Separador vertical sutil */}
              <div className="h-6 w-px bg-border mx-1" />
              {/* Botón Mermas - con color amber sutil para indicar atención */}
              {activeRole && ["admin", "supervisor", "cajero"].includes(activeRole) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReturnsDialog(true)}
                  disabled={!currentSession}
                  className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  aria-label="Registrar mermas o devoluciones"
                >
                  <PackageMinus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1.5">Mermas</span>
                </Button>
              )}

              {/* Campana de notificaciones */}
              <NotificationBell />
            </div>

            {/* Sección Derecha: Cerrar Caja */}
            {activeRole && ["admin", "supervisor", "cajero"].includes(activeRole) && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleStartCashClosure}
                disabled={!currentSession}
                className="ml-auto"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Caja
              </Button>
            )}
          </div>
        </header>

        {/* Banner de Modo Pago de Deuda */}
        {isDebtPaymentMode && (
          <div className="bg-primary/10 border-b border-primary/30 py-2">
            <div className="px-4">
              <p className="text-sm text-center text-primary font-medium">
                🔄 Modo: Pago de Deuda – No hay artículos en el carrito
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Left Panel - Search + Cart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search */}
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">Búsqueda de Productos</h2>
              <ProductSearchAutocomplete onSelect={addToCart} disabled={isPOSBlocked} />
              {isPOSBlocked ? (
                <p className="text-xs text-destructive mt-2">Seleccioná una caja para comenzar a trabajar</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  Presiona F2 para buscar o escanea el código de barras
                </p>
              )}
            </Card>

            {/* Cart Items */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Items de Venta</h2>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Vaciar
                  </Button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">No hay productos en la venta</p>
                  <p className="text-sm text-muted-foreground">Busca y agrega productos para comenzar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                    <div className="col-span-5">Producto</div>
                    <div className="col-span-2 text-center">Cantidad</div>
                    <div className="col-span-2 text-right">Precio</div>
                    <div className="col-span-2 text-right">Subtotal</div>
                    <div className="col-span-1"></div>
                  </div>

                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="grid grid-cols-12 gap-4 items-center py-3 border-b hover:bg-secondary/50 transition-colors"
                    >
                      <div className="col-span-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{item.product.name}</p>
                          {item.product.stock_disabled ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs"
                            >
                              Stock desactivado
                            </Badge>
                          ) : (
                            item.product.stock - item.quantity < 0 && (
                              <Badge variant="destructive" className="text-xs">
                                Requiere Autorización
                              </Badge>
                            )
                          )}
                          {!item.product.stock_disabled && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs"
                            >
                              Stock: {item.product.stock}
                            </Badge>
                          )}
                          {item.expirationInfo && (
                            <Badge
                              variant={
                                item.expirationInfo.severity === "critical"
                                  ? "destructive"
                                  : item.expirationInfo.severity === "warning"
                                    ? "default"
                                    : "secondary"
                              }
                              className="text-xs flex items-center gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              {item.expirationInfo.daysUntilExpiration <= 0
                                ? "Vencido"
                                : `${item.expirationInfo.daysUntilExpiration}d`}
                            </Badge>
                          )}
                        </div>
                        {item.product.barcode && (
                          <p className="text-xs text-muted-foreground">{item.product.barcode}</p>
                        )}
                      </div>

                      <div className="col-span-2 text-center">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={quantityInputs[item.product.id] ?? item.quantity.toString()}
                          onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                          onBlur={() => commitQuantityInput(item.product.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitQuantityInput(item.product.id);
                            }
                          }}
                          className="w-16 h-8 text-center border rounded bg-background"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        {canEditPrice ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.product.price}
                              onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 text-right border rounded bg-background px-2"
                              title="Editar precio"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span>${item.product.price.toFixed(2)}</span>
                            <span className="text-muted-foreground" title="Sin permiso para editar precio">
                              🔒
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 text-right font-medium">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </div>

                      <div className="col-span-1 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromCart(item.product.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Panel - Totals + Actions */}
          <div className="space-y-6">
            {/* Totals */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Items</p>
                  <p className="text-4xl font-bold">{getTotalItems()}</p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${getSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA incluido:</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-lg font-medium">Total:</span>
                  <span className="text-3xl font-bold text-primary">${getTotal().toFixed(2)}</span>
                </div>
              </div>
            </Card>

            {/* Customer Info */}
            {selectedCustomer && (
              <Card className="p-4 bg-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{selectedCustomer.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Límite:</span>
                    <span>${selectedCustomer.credit_limit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deuda:</span>
                    <span className="text-warning">${selectedCustomer.current_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Disponible:</span>
                    <span className="text-success">
                      ${(selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={savePendingSale}
                disabled={cart.length === 0 || isPOSBlocked}
              >
                <Clock className="mr-2 h-5 w-5" />
                Poner en Espera (F7)
              </Button>

              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => setShowCustomerDialog(true)}
                disabled={isPOSBlocked}
              >
                <User className="mr-2 h-5 w-5" />
                Crédito / Fiado (F5)
              </Button>

              <Button
                variant={isDebtPaymentMode ? "secondary" : "default"}
                className="w-full h-14 text-lg"
                onClick={handleF12Cobrar}
                disabled={isF12Disabled || isPOSBlocked}
              >
                {isDebtPaymentMode ? (
                  <>
                    <DollarSign className="mr-2 h-5 w-5" />
                    💰 Pagar Deuda (F12)
                  </>
                ) : (
                  <>💸 Cobrar (F12)</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          total={getTotal()}
          onComplete={completeSale}
        />

        <CustomerSelectDialog
          open={showCustomerDialog}
          onClose={() => setShowCustomerDialog(false)}
          onSelect={handleCustomerSelect}
          onClear={handleClearCustomer}
        />

        <CreditOptionsModal
          open={showCustomerAction}
          onClose={() => setShowCustomerAction(false)}
          customer={tempCustomer}
          cartTotal={getTotal()}
          onFiar={handleFiar}
          onPayPartial={handlePayPartial}
          onPayTotal={handlePayTotal}
        />

        <DebtPaymentModal
          open={showDebtPayment}
          onClose={() => setShowDebtPayment(false)}
          customer={tempCustomer}
          onPaymentComplete={handleDebtPaymentComplete}
          mode={debtPaymentMode}
        />

        <SupervisorPinDialog
          open={showSupervisorPin}
          onOpenChange={setShowSupervisorPin}
          onSuccess={handleSupervisorAuthSuccess}
          title="Autorización Requerida"
          description="Hay productos sin stock en el carrito. Se requiere autorización de supervisor para continuar."
        />

        <PendingSalesDrawer
          open={showPendingSales}
          onClose={() => setShowPendingSales(false)}
          onLoad={loadPendingSale}
        />

        <ReturnsAndLossesDialog
          open={showReturnsDialog}
          onOpenChange={setShowReturnsDialog}
          cashRegisterSessionId={currentSession?.id}
        />

        <ExpenseDialog
          open={showExpenseDialog}
          onClose={() => setShowExpenseDialog(false)}
          expense={null}
          suppliers={suppliers}
        />

        <ExpenseTypeDialog
          open={showExpenseTypeDialog}
          onClose={() => setShowExpenseTypeDialog(false)}
          onSelectExpense={() => setShowCashExpenseDialog(true)}
        />

        <CashExpenseDialog
          open={showCashExpenseDialog}
          onOpenChange={setShowCashExpenseDialog}
          cashRegisterId={currentSession?.id || null}
          userId={user?.id}
        />

        <CashRegisterSelectionModal
          open={showCashRegisterModal}
          userId={user?.id || ""}
          userRole={activeRole || ""}
          onSessionSelected={handleSessionSelected}
          canClose={true}
          onOpenChange={setShowCashRegisterModal}
        />

        <GenericProductDialog
          open={showGenericProduct}
          onClose={() => setShowGenericProduct(false)}
          onAdd={addGenericProduct}
        />
      </div>
    </MainLayout>
  );
};
export default POS;
