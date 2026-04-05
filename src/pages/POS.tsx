import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PaymentModal from "@/components/pos/PaymentModal";
import CustomerSelectDialog from "@/components/pos/CustomerSelectDialog";
import CreditOptionsModal from "@/components/pos/CreditOptionsModal";
import DebtPaymentModal from "@/components/pos/DebtPaymentModal";
import PendingSalesDrawer from "@/components/pos/PendingSalesDrawer";
import CashRegisterSelectionModal from "@/components/pos/CashRegisterSelectionModal";
import SupervisorPinDialog from "@/components/pos/SupervisorPinDialog";
import { ReturnsAndLossesDialog } from "@/components/pos/ReturnsAndLossesDialog";
import ExpenseDialog from "@/components/expenses/ExpenseDialog";
import ExpenseTypeDialog from "@/components/pos/ExpenseTypeDialog";
import CashExpenseDialog from "@/components/pos/CashExpenseDialog";
import type { Supplier } from "@/components/expenses/ExpensesTab";
import GenericProductDialog from "@/components/pos/GenericProductDialog";
import { useNotifications } from "@/hooks/useNotifications";
import MainLayout from "@/components/layout/MainLayout";
import { POSRedoBanner } from "@/components/pos/POSRedoBanner";
import { POSHeader } from "@/components/pos/POSHeader";
import { POSCartPanel } from "@/components/pos/POSCartPanel";
import { POSSummaryPanel } from "@/components/pos/POSSummaryPanel";

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
        {originalSaleId && (
          <POSRedoBanner
            saleNumber={originalSaleNumber!}
            onCancel={() => {
              setOriginalSaleId(null);
              setOriginalSaleNumber(null);
              setCart([]);
              setSelectedCustomer(null);
              toast.info("Rehacer venta cancelado");
            }}
          />
        )}

        <POSHeader
          userEmail={user?.email}
          currentTime={currentTime}
          activeRole={activeRole}
          isPOSBlocked={isPOSBlocked}
          hasOpenSession={!!currentSession}
          pendingSalesCount={pendingSalesCount}
          onPendingSalesClick={() => setShowPendingSales(true)}
          onExpensesClick={() => setShowExpenseTypeDialog(true)}
          onGenericProductClick={() => setShowGenericProduct(true)}
          onReturnsClick={() => setShowReturnsDialog(true)}
          onCloseCashRegister={handleStartCashClosure}
        />

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
          <POSCartPanel
            cart={cart}
            isPOSBlocked={isPOSBlocked}
            canEditPrice={canEditPrice}
            quantityInputs={quantityInputs}
            addToCart={addToCart}
            clearCart={clearCart}
            removeFromCart={removeFromCart}
            onQuantityChange={handleQuantityInputChange}
            onQuantityCommit={commitQuantityInput}
            onPriceChange={updatePrice}
          />

          <POSSummaryPanel
            totalItems={getTotalItems()}
            subtotal={getSubtotal()}
            total={getTotal()}
            selectedCustomer={selectedCustomer}
            cartIsEmpty={cart.length === 0}
            isPOSBlocked={isPOSBlocked}
            isDebtPaymentMode={isDebtPaymentMode}
            isF12Disabled={isF12Disabled}
            onClearCustomer={() => setSelectedCustomer(null)}
            onSavePending={savePendingSale}
            onOpenCustomerDialog={() => setShowCustomerDialog(true)}
            onCobrar={handleF12Cobrar}
          />
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
