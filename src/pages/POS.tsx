import { useState, useEffect, useCallback, useRef } from "react";
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
import type { Supplier } from "@/components/expenses/ExpensesTab";
import GenericProductDialog from "@/components/pos/GenericProductDialog";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { NotificationBell } from "@/components/NotificationBell";

import { useNotifications } from "@/hooks/useNotifications";
import { EXPIRATION_THRESHOLDS } from "@/hooks/useProductExpiration";
import { generateSaleA4PDF, generateSaleTicketPDF, generateSaleDualA4PDF } from "@/lib/pdfSaleGenerator";
import MainLayout from "@/components/layout/MainLayout";
import { SidebarTrigger } from "@/components/ui/sidebar";
interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  stock: number;
  min_stock: number;
  stock_disabled?: boolean;
}
interface CartItem {
  product: Product;
  quantity: number;
  expirationInfo?: {
    daysUntilExpiration: number;
    nearestExpirationDate: string;
    quantity: number;
    severity: "critical" | "warning" | "notice";
  };
}
interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  document: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  current_balance: number;
  status: string;
}
interface CashSession {
  id: string;
  cash_register_id: string;
  cashier_id: string;
  opening_amount: number;
  opened_at: string;
  status: string;
  cash_registers: {
    name: string;
    location: string | null;
  };
}
const POS = () => {
  const { user, loading, activeRole } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem("pos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sincronizar cart con sessionStorage
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem("pos_cart", JSON.stringify(cart));
      } else {
        sessionStorage.removeItem("pos_cart");
      }
    } catch {
      // storage full or unavailable
    }
  }, [cart]);

  // Efecto para actualizar la hora cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    try {
      const saved = sessionStorage.getItem("pos_customer");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sincronizar selectedCustomer con sessionStorage
  useEffect(() => {
    try {
      if (selectedCustomer) {
        sessionStorage.setItem("pos_customer", JSON.stringify(selectedCustomer));
      } else {
        sessionStorage.removeItem("pos_customer");
      }
    } catch {}
  }, [selectedCustomer]);
  const [tempCustomer, setTempCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showCustomerAction, setShowCustomerAction] = useState(false);
  const [showDebtPayment, setShowDebtPayment] = useState(false);
  const [debtPaymentMode, setDebtPaymentMode] = useState<"partial" | "total">("total");
  const [showPendingSales, setShowPendingSales] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [showReturnsDialog, setShowReturnsDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showGenericProduct, setShowGenericProduct] = useState(false);
  const [canEditPrice, setCanEditPrice] = useState(false);

  // Cash register session state
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Supervisor authorization for stock disabled
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [stockDisabled, setStockDisabled] = useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<(() => void) | null>(null);
  const [productsRequiringAuth, setProductsRequiringAuth] = useState<CartItem[]>([]);

  // Controles temporales de inputs de cantidad por producto
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // Estado para "Rehacer venta"
  const [originalSaleId, setOriginalSaleId] = useState<string | null>(null);
  const [originalSaleNumber, setOriginalSaleNumber] = useState<number | null>(null);

  // Protección contra doble click / doble tecla en ventas
  const isProcessingSaleRef = useRef(false);
  const { notifySupervisorOverride } = useNotifications();
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    // Cargar permiso de edición de precios
    const fetchPricePermission = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from("profiles").select("can_edit_price").eq("id", user.id).single();
      setCanEditPrice(data?.can_edit_price || false);
    };
    if (user?.id) {
      fetchPricePermission();
    }

    // Guard: Solo admin, supervisor, cajero y super_admin pueden acceder al POS
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

  // Cargar proveedores para el dialog de gastos
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase.from("suppliers").select("*").eq("is_active", true).order("name");
      if (data) setSuppliers(data as Supplier[]);
    };
    if (user) fetchSuppliers();
  }, [user]);

  // Detectar datos de "Rehacer venta" en sessionStorage
  useEffect(() => {
    const loadRedoSale = async () => {
      try {
        const redoRaw = sessionStorage.getItem("pos_redo_sale");
        if (!redoRaw) return;

        const redoData = JSON.parse(redoRaw);
        sessionStorage.removeItem("pos_redo_sale");
        sessionStorage.removeItem("pos_cart");
        sessionStorage.removeItem("pos_customer");

        setOriginalSaleId(redoData.originalSaleId);
        setOriginalSaleNumber(redoData.originalSaleNumber);

        // Fetch real product data from DB
        const productIds = redoData.items.filter((i: any) => i.product_id).map((i: any) => i.product_id);

        let dbProducts: any[] = [];
        if (productIds.length > 0) {
          const { data } = await supabase
            .from("products")
            .select(
              `
              id, name, price, barcode, stock, min_stock, stock_disabled,
              product_stock_balance ( current_balance )
            `,
            )
            .in("id", productIds);
          dbProducts = (data || []).map((p) => {
            const balance = Array.isArray(p.product_stock_balance)
              ? p.product_stock_balance[0]?.current_balance
              : (p.product_stock_balance as any)?.current_balance;
            return { ...p, stock: balance ?? p.stock };
          });
        }

        const cartItems: CartItem[] = redoData.items.map((item: any) => {
          const dbProduct = item.product_id ? dbProducts.find((p: any) => p.id === item.product_id) : null;

          if (dbProduct) {
            return {
              product: {
                id: dbProduct.id,
                name: dbProduct.name,
                price: item.unit_price, // keep original sale price
                barcode: dbProduct.barcode,
                stock: dbProduct.stock,
                min_stock: dbProduct.min_stock ?? 0,
                stock_disabled: dbProduct.stock_disabled ?? false,
              },
              quantity: item.quantity,
            };
          }
          // Generic product fallback
          return {
            product: {
              id: `generic-redo-${Date.now()}-${Math.random()}`,
              name: item.product_name,
              price: item.unit_price,
              barcode: null,
              stock: 999,
              min_stock: 0,
              stock_disabled: true,
            },
            quantity: item.quantity,
          };
        });
        setCart(cartItems);

        if (redoData.customerId) {
          const { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("id", redoData.customerId)
            .single();
          if (customer) {
            setSelectedCustomer(customer as any);
          }
        }

        toast.info(`Venta #${redoData.originalSaleNumber} cargada. Modificá y cobrá para reemplazarla.`);
      } catch (e) {
        console.error("Error loading redo sale data:", e);
      }
    };
    loadRedoSale();
  }, []);
  const checkCashRegisterSession = async () => {
    try {
      setSessionLoading(true);

      // Buscar sesión abierta del usuario (tomar la más reciente si hay múltiples)
      const { data: sessions, error } = await supabase
        .from("cash_register")
        .select(
          `
          id,
          cash_register_id,
          cashier_id,
          opening_amount,
          opened_at,
          status,
          cash_registers (name, location)
        `,
        )
        .eq("cashier_id", user?.id)
        .eq("status", "open")
        .order("opened_at", {
          ascending: false,
        });
      if (error) throw error;
      if (sessions && sessions.length > 0) {
        // Tomar la sesión más reciente
        const session = sessions[0];
        setCurrentSession(session as any);
        setShowCashRegisterModal(false);

        // Advertir si hay múltiples sesiones abiertas
        if (sessions.length > 1) {
          toast.warning(`Tenés ${sessions.length} sesiones de caja abiertas. Se seleccionó la más reciente.`);
        }
      } else {
        // No hay sesión, mostrar modal
        setShowCashRegisterModal(true);
      }
    } catch (error: any) {
      console.error("Error checking session:", error);
      toast.error("Error al verificar la sesión de caja");
    } finally {
      setSessionLoading(false);
    }
  };
  const handleSessionSelected = (session: CashSession) => {
    setCurrentSession(session);
    setShowCashRegisterModal(false);
    toast.success(`Trabajando en ${session.cash_registers.name}`);
  };
  const handleChangeCashRegister = () => {
    setShowCashRegisterModal(true);
  };
  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase.from("company_settings").select("stock_disabled").limit(1).maybeSingle();
      if (error) throw error;
      if (data) {
        setStockDisabled(data.stock_disabled || false);
      }
    } catch (error: any) {
      console.error("Error loading company settings:", error);
    }
  };

  // Keyboard shortcuts
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
  const fetchPendingSalesCount = async () => {
    try {
      const { count, error } = await supabase
        .from("pending_sales")
        .select("*", {
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
  const addToCart = useCallback(
    async (product: Product, quantity: number = 1) => {
      // Obtener el stock real actual desde product_stock_balance
      const { data: balanceData } = await supabase
        .from("product_stock_balance")
        .select("current_balance")
        .eq("product_id", product.id)
        .maybeSingle();
      const currentStock = balanceData?.current_balance ?? 0;
      const updatedProduct = {
        ...product,
        stock: currentStock,
      };

      // Verificar lotes próximos a vencer
      const today = new Date();
      const futureLimit = new Date();
      futureLimit.setDate(today.getDate() + EXPIRATION_THRESHOLDS.NOTICE);
      const { data: expiringBatch } = await supabase
        .from("product_batches")
        .select("expiration_date, quantity")
        .eq("product_id", product.id)
        .eq("status", "active")
        .gt("quantity", 0)
        .lte("expiration_date", futureLimit.toISOString())
        .order("expiration_date")
        .limit(1)
        .maybeSingle();
      let expirationInfo = undefined;
      if (expiringBatch) {
        const daysUntil = differenceInDays(parseISO(expiringBatch.expiration_date), today);
        let severity: "critical" | "warning" | "notice" = "notice";
        if (daysUntil <= EXPIRATION_THRESHOLDS.CRITICAL) {
          severity = "critical";
        } else if (daysUntil <= EXPIRATION_THRESHOLDS.WARNING) {
          severity = "warning";
        }
        expirationInfo = {
          daysUntilExpiration: daysUntil,
          nearestExpirationDate: expiringBatch.expiration_date,
          quantity: expiringBatch.quantity,
          severity,
        };

        // Toast de advertencia sobre vencimiento
        if (daysUntil <= 0) {
          toast.error(`⚠️ ${product.name} tiene ${expiringBatch.quantity} unidades VENCIDAS`);
        } else if (daysUntil <= EXPIRATION_THRESHOLDS.CRITICAL) {
          toast.error(`⚠️ ${product.name} tiene ${expiringBatch.quantity} unidades que vencen en ${daysUntil} días`);
        } else if (daysUntil <= EXPIRATION_THRESHOLDS.WARNING) {
          toast.warning(`⚠️ ${product.name} tiene ${expiringBatch.quantity} unidades que vencen en ${daysUntil} días`);
        } else {
          toast.info(`ℹ️ ${product.name} tiene ${expiringBatch.quantity} unidades que vencen en ${daysUntil} días`);
        }
      }
      let added = false;
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.product.id === updatedProduct.id);
        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;
          const stockProyectado = currentStock - newQuantity;

          if (!updatedProduct.stock_disabled && stockProyectado < 0) {
            toast.error(`${updatedProduct.name}: Sin stock disponible. Stock actual: ${currentStock}`);
            return prevCart;
          }

          if (stockProyectado < 0 && updatedProduct.stock_disabled) {
            toast.warning(`${updatedProduct.name} quedará en stock negativo: ${stockProyectado}`);
          } else if (currentStock > 0 && newQuantity > currentStock && !updatedProduct.stock_disabled) {
            toast.warning(`Stock limitado: ${currentStock} disponibles`);
          }
          added = true;
          return prevCart.map((item) =>
            item.product.id === updatedProduct.id
              ? {
                  ...item,
                  product: updatedProduct,
                  quantity: newQuantity,
                  expirationInfo,
                }
              : item,
          );
        } else {
          const stockProyectado = currentStock - quantity;

          if (!updatedProduct.stock_disabled && stockProyectado < 0) {
            toast.error(`${updatedProduct.name}: Sin stock disponible. Stock actual: ${currentStock}`);
            return prevCart;
          }

          if (stockProyectado < 0 && updatedProduct.stock_disabled) {
            toast.warning(`${updatedProduct.name} quedará en stock negativo: ${stockProyectado}`);
          } else if (quantity > currentStock && updatedProduct.stock_disabled) {
            toast.info(`${updatedProduct.name} - Stock proyectado: ${stockProyectado}`);
          }
          added = true;
          return [{ product: updatedProduct, quantity, expirationInfo }, ...prevCart];
        }
      });
      if (added) {
        toast.success(`${product.name} agregado`);
      }
    },
    [activeRole],
  );
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      if (item.product.stock > 0 && quantity > item.product.stock) {
        toast.warning(`Stock limitado: ${item.product.stock} disponibles`);
      }
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i));
    });
  };

  // Manejo de edición de cantidad (permite estados intermedios como '0' o ',')
  const handleQuantityInputChange = (productId: string, value: string) => {
    setQuantityInputs((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };
  const commitQuantityInput = (productId: string) => {
    const raw = quantityInputs[productId];
    if (raw === undefined) return; // nada que confirmar

    const sanitized = raw.replace(",", ".");
    const parsed = parseFloat(sanitized);
    if (Number.isNaN(parsed)) {
      // Revertir a cantidad actual en carrito
      setQuantityInputs((prev) => {
        const next = {
          ...prev,
        };
        delete next[productId];
        return next;
      });
      return;
    }
    if (parsed <= 0) {
      // Evitar eliminar al escribir 0; clamplear al mínimo permitido
      updateQuantity(productId, 0.01);
    } else {
      updateQuantity(productId, parsed);
    }

    // Limpiar estado temporal para volver a reflejar el valor del carrito
    setQuantityInputs((prev) => {
      const next = {
        ...prev,
      };
      delete next[productId];
      return next;
    });
  };
  const updatePrice = async (productId: string, newPrice: number) => {
    if (!canEditPrice) {
      toast.error("No tenés permiso para modificar precios");
      return;
    }
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;
    const originalPrice = item.product.price;
    if (newPrice <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }

    // Actualizar el precio en el carrito
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              product: {
                ...item.product,
                price: newPrice,
              },
            }
          : item,
      ),
    );

    toast.success("Precio actualizado para esta venta");

    // Registrar en price_override_logs (se completará con sale_id después de la venta)
    try {
      const { error: logError } = await supabase.from("price_override_logs").insert({
        user_id: user?.id,
        product_id: productId,
        original_price: originalPrice,
        new_price: newPrice,
        sale_id: null, // Se actualizará cuando se complete la venta
      });
      if (logError) throw logError;
    } catch (error: any) {
      console.error("Error logging price change:", error);
    }
  };

  const addGenericProduct = (data: { name: string; price: number; quantity: number }) => {
    const virtualProduct: Product = {
      id: `generic-${Date.now()}`,
      name: data.name,
      price: data.price,
      barcode: null,
      stock: 999,
      min_stock: 0,
      stock_disabled: true,
    };
    setCart((prev) => [{ product: virtualProduct, quantity: data.quantity }, ...prev]);
    toast.success(`${data.name} agregado (genérico)`);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("¿Vaciar el carrito?")) {
      setCart([]);
      setSelectedCustomer(null);
    }
  };
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };
  const getTotal = () => {
    return getSubtotal(); // IVA incluido en precio
  };
  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + Math.ceil(item.quantity), 0);
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
          customer_name: selectedCustomer?.name || null,
          customer_id: selectedCustomer?.id || null,
          items: cart as any,
          total: getTotal(),
          notes: selectedCustomer ? `Cliente: ${selectedCustomer.name}` : null,
        } as any,
      ]);
      if (error) throw error;
      toast.success("Venta guardada en espera");
      setCart([]);
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
        let query = supabase.from("customers").select("*").eq("status", "active");
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
  const handleF12Cobrar = () => {
    // Verificar productos que necesitan autorización (stock_disabled = false y stock negativo)
    const needsAuthorization = cart.some((item) => {
      const stockProyectado = item.product.stock - item.quantity;
      return !item.product.stock_disabled && stockProyectado < 0;
    });

    // Si hay productos que necesitan autorización, solicitarla
    if (needsAuthorization && cart.length > 0) {
      // Guardar los productos que requieren autorización
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
      // Ramificación: sin cliente vs con cliente
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

    // Ejecutar la acción pendiente después de la autorización
    if (pendingPaymentAction) {
      pendingPaymentAction();
      setPendingPaymentAction(null);
    }
  };
  const calculateAvailableCredit = async (customer: Customer): Promise<number> => {
    try {
      // Obtener ventas en espera del cliente
      const { data: pendingSales, error } = await supabase
        .from("pending_sales")
        .select("total")
        .ilike("notes", `%${customer.name}%`);
      if (error) throw error;
      const pendingTotal = pendingSales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      const available = customer.credit_limit - (customer.current_balance + pendingTotal);
      return available;
    } catch (error) {
      console.error("Error calculando disponible:", error);
      return customer.credit_limit - customer.current_balance;
    }
  };
  const handleFiar = async (ticketType: string = "no_imprimir", showDebt: boolean = true) => {
    if (!tempCustomer) return;
    if (isProcessingSaleRef.current) return;
    isProcessingSaleRef.current = true;
    const total = getTotal();
    const available = await calculateAvailableCredit(tempCustomer);
    const wouldExceed = available < total;

    // Procesar venta a crédito automáticamente (sin pedir confirmación)
    setShowCustomerAction(false);

    // Usar tempCustomer directamente en lugar de esperar que selectedCustomer se actualice
    try {
      const saleResult = await completeSaleForCustomer("credit", tempCustomer);

      // Si se excedió el crédito, notificar a los administradores
      if (wouldExceed && saleResult?.saleId) {
        const missingAmount = total - available;
        await notifyAdminsAboutCreditExcess(tempCustomer, total, missingAmount, saleResult.saleId);
        toast.success(`Venta fiada (excedió crédito). Se notificó al administrador.`);
      } else {
        toast.success(`Venta a crédito completada para ${tempCustomer.name}`);
      }

      // Imprimir recibo con copia si se seleccionó un formato
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

  // Función para imprimir recibos de ventas fiadas con copia empresa y cliente
  const printCreditReceipt = async (
    saleId: string,
    customer: Customer,
    ticketType: string,
    showDebt: boolean = true,
  ) => {
    if (ticketType === "no_imprimir") return;

    try {
      // Obtener datos de la venta
      const { data: saleData, error: saleError } = await supabase.from("sales").select("*").eq("id", saleId).single();

      if (saleError || !saleData) {
        console.error("Error al obtener datos de venta:", saleError);
        return;
      }

      // Obtener items de la venta
      const { data: saleItems, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", saleId);

      if (itemsError) {
        console.error("Error al obtener items:", itemsError);
        return;
      }

      // Obtener configuración de la empresa
      const { data: companySettings } = await supabase.from("company_settings").select("*").limit(1).single();

      // Obtener nuevo balance del cliente
      const { data: updatedCustomer } = await supabase
        .from("customers")
        .select("current_balance")
        .eq("id", customer.id)
        .single();

      // Preparar datos de la caja
      const cashRegisterData = currentSession
        ? {
            name: currentSession.cash_registers?.name || "N/A",
            location: currentSession.cash_registers?.location,
          }
        : null;

      // Preparar datos del cliente con balance actualizado
      const customerData = {
        name: customer.name,
        last_name: customer.last_name,
        document: customer.document,
        rut: null,
        phone: customer.phone,
        address: customer.address,
        current_balance: showDebt ? (updatedCustomer?.current_balance ?? customer.current_balance) : undefined,
      };

      // Preparar datos de la venta
      const formattedSale = {
        sale_number: saleData.sale_number,
        created_at: saleData.created_at,
        total: saleData.total,
        payment_method: saleData.payment_method,
        cash_amount: saleData.cash_amount,
        card_amount: saleData.card_amount,
        credit_amount: saleData.credit_amount,
        customer_name: saleData.customer_name,
        cashier: {
          full_name: user?.user_metadata?.full_name || user?.email || "N/A",
        },
        customer: customerData,
        cash_register: cashRegisterData,
        session_id: currentSession?.id,
        notes: saleData.notes,
        replaces_sale_number: originalSaleNumber || undefined,
      };

      // Preparar items
      const items = (saleItems || []).map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      // Preparar configuración de empresa
      const company = companySettings
        ? {
            company_name: companySettings.company_name,
            tax_id: companySettings.tax_id,
            address: companySettings.address,
            city: companySettings.city,
            phone: companySettings.phone,
            email: companySettings.email,
            currency: companySettings.currency,
            receipt_footer: companySettings.receipt_footer,
            logo_url: companySettings.logo_url,
          }
        : undefined;

      // Generar copias
      if (ticketType === "a4") {
        // Una sola hoja A4 con ambas copias (Cliente + Empresa)
        await generateSaleDualA4PDF(formattedSale, items, company);
      } else {
        // Tickets: 2 tickets separados (correcto para tickeadora)
        await generateSaleTicketPDF(formattedSale, items, company, "COPIA EMPRESA");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await generateSaleTicketPDF(formattedSale, items, company, "COPIA CLIENTE");
      }
    } catch (error) {
      console.error("Error generando recibos de crédito:", error);
    }
  };
  const notifyAdminsAboutCreditExcess = async (
    customer: Customer,
    total: number,
    missingAmount: number,
    saleId: string,
  ) => {
    try {
      // Obtener todos los usuarios con rol admin
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesError) throw rolesError;
      if (!adminRoles || adminRoles.length === 0) {
        console.log("No hay administradores para notificar");
        return;
      }

      // Obtener información del cajero actual
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id).single();

      // Obtener información del registro de caja activo
      const { data: cashRegister } = await supabase
        .from("cash_register")
        .select("id")
        .eq("cashier_id", user?.id)
        .eq("status", "open")
        .single();

      // Crear notificaciones para cada admin evitando duplicados por (sale_id + type + user)
      const adminIds = adminRoles.map((r) => r.user_id);
      const { data: existing } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("type", "fiado_excedido")
        .eq("related_sale_id", saleId)
        .in("user_id", adminIds);
      const alreadyNotified = new Set((existing || []).map((e: any) => e.user_id));
      const customerFullName = [customer.name, customer.last_name].filter(Boolean).join(" ");
      const notifications = adminIds
        .filter((id) => !alreadyNotified.has(id))
        .map((adminId) => ({
          user_id: adminId,
          type: "fiado_excedido",
          title: "Fiado Excedido",
          message: `${customerFullName} excedió su crédito por $${missingAmount.toFixed(2)}. Total: $${total.toFixed(2)}`,
          related_sale_id: saleId,
          related_customer_id: customer.id,
          metadata: {
            customer_name: customerFullName,
            sale_total: total,
            missing_amount: missingAmount,
            customer_balance: customer.current_balance,
            customer_limit: customer.credit_limit,
            cashier_id: user?.id,
            cashier_name: profile?.full_name || "Desconocido",
            cash_register_id: cashRegister?.id,
          },
        }));
      if (notifications.length === 0) return;
      const { error: notifyError } = await supabase.from("notifications").insert(notifications);
      if (notifyError) throw notifyError;
      console.log("Administradores notificados sobre fiado excedido");
    } catch (error: any) {
      console.error("Error al notificar administradores:", error.message);
      // No fallar la venta si falla la notificación
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
        // Validar si se puede completar la venta con el nuevo saldo
        const total = getTotal();
        const newAvailable = updatedCustomer.credit_limit - updatedCustomer.current_balance;
        if (newAvailable >= total) {
          // Procesar venta a crédito automáticamente
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
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setShowCustomerDialog(false);
    toast.success("Cliente eliminado");
  };

  // Función para anular la venta original al rehacer
  const cancelOriginalSale = async (newSaleId: string, newSaleNumber: number) => {
    if (!originalSaleId) return;

    try {
      // 1. Obtener items de la venta original para revertir stock
      const { data: originalItems } = await supabase.from("sale_items").select("*").eq("sale_id", originalSaleId);

      // 2. Obtener datos de la venta original
      const { data: originalSale } = await supabase.from("sales").select("*").eq("id", originalSaleId).single();

      if (!originalSale) throw new Error("Venta original no encontrada");

      // 3. Revertir stock de cada item
      if (originalItems) {
        for (const item of originalItems) {
          if (!item.product_id) continue;

          const { data: product } = await supabase
            .from("products")
            .select("stock, stock_disabled")
            .eq("id", item.product_id)
            .single();

          if (!product) continue;

          if (product.stock_disabled) continue;

          const previousStock = product.stock;
          const newStock = previousStock + item.quantity;

          // Check if product has active batches
          const { data: activeBatch } = await supabase
            .from("product_batches")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeBatch) {
            // Update batch quantity; trigger will auto-sync products.stock
            await supabase
              .from("product_batches")
              .update({ quantity: activeBatch.quantity + item.quantity })
              .eq("id", activeBatch.id);
          } else {
            // No batches: update products.stock directly
            await supabase.from("products").update({ stock: newStock }).eq("id", item.product_id);
          }

          // Registrar movimiento de devolución
          await supabase.from("stock_movements").insert({
            product_id: item.product_id,
            movement_type: "sale_redo_return",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: originalSaleId,
            performed_by: user?.id,
            notes: `Devolución por rehacer venta #${originalSaleNumber} → #${newSaleNumber}`,
          });
        }
      }

      // 4. Si la venta original tenía crédito, revertir crédito
      if ((originalSale.credit_amount ?? 0) > 0 && originalSale.customer_id) {
        // Cancelar el crédito asociado
        await supabase.from("credits").update({ status: "cancelled", balance: 0 }).eq("sale_id", originalSaleId);

        // Recalculate current_balance from actual pending credits
        const { data: activeCredits } = await supabase
          .from("credits")
          .select("balance")
          .eq("customer_id", originalSale.customer_id)
          .in("status", ["pending", "partial"]);

        const recalculatedBalance = (activeCredits || []).reduce((sum: number, c: any) => sum + (c.balance ?? 0), 0);

        await supabase
          .from("customers")
          .update({ current_balance: recalculatedBalance })
          .eq("id", originalSale.customer_id);
      }

      // 5. Anular la venta original
      await (supabase as any)
        .from("sales")
        .update({
          status: "cancelled",
          notes: `Anulada y reemplazada por venta #${newSaleNumber}`,
        })
        .eq("id", originalSaleId);

      // 6. Vincular la nueva venta con la original
      await (supabase as any).from("sales").update({ replaces_sale_id: originalSaleId }).eq("id", newSaleId);

      // Limpiar estado de redo
      setOriginalSaleId(null);
      setOriginalSaleNumber(null);
    } catch (error: any) {
      console.error("Error al anular venta original:", error);
      toast.error("Error al anular la venta original: " + error.message);
    }
  };

  // Versión especial para ventas a crédito con customer específico (permite exceder límite)
  // Descontar lotes por FEFO (First Expired, First Out)
  const deductFromBatches = async (productId: string, quantity: number) => {
    const { data: batches } = await supabase
      .from("product_batches")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("status", "active")
      .gt("quantity", 0)
      .order("expiration_date", { ascending: true });

    if (!batches || batches.length === 0) return;

    let remaining = quantity;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const deduct = Math.min(batch.quantity, remaining);
      const newQty = batch.quantity - deduct;

      await supabase.from("product_batches").update({ quantity: newQty }).eq("id", batch.id);

      remaining -= deduct;
    }
  };

  const completeSaleForCustomer = async (
    paymentMethod: string,
    customer: Customer,
    cashAmount?: number,
    cardAmount?: number,
    receivedAmount?: number,
  ): Promise<
    | {
        saleId: string;
      }
    | undefined
  > => {
    if (isProcessingSaleRef.current && paymentMethod !== "credit") return;
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    const total = getTotal();

    // Determinar si excede para marcar la venta en notas
    const available = await calculateAvailableCredit(customer);
    const creditExceeded = paymentMethod === "credit" && available < total;
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          cashier_id: user?.id,
          customer_id: customer.id,
          customer_name: `${customer.name} ${customer.last_name || ""}`.trim(),
          total,
          payment_method: paymentMethod,
          cash_amount: cashAmount || (paymentMethod === "cash" ? total : null),
          card_amount: cardAmount || (paymentMethod === "card" ? total : null),
          credit_amount: paymentMethod === "credit" ? total : null,
          notes: creditExceeded ? "credit_exceeded" : null,
          cash_register_session_id: currentSession?.id || null,
        })
        .select()
        .single();
      if (saleError) throw saleError;
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id.startsWith("generic-") ? null : item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Procesar stock para cada item del carrito
      for (const item of cart) {
        if (item.product.id.startsWith("generic-")) continue; // Skip generic products
        if (!item.product.stock_disabled) {
          const previousStock = Math.max(0, item.product.stock);
          const newStock = Math.max(0, previousStock - item.quantity);

          // Registrar movimiento de stock (historial)
          await supabase.from("stock_movements").insert({
            product_id: item.product.id,
            movement_type: "sale",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: sale.id,
            performed_by: user?.id,
            notes: `Venta #${sale.sale_number}`,
          });

          // Descontar lotes FEFO (el trigger recalcula products.stock)
          await deductFromBatches(item.product.id, item.quantity);

          // Solo actualizar stock manual si NO tiene lotes activos
          const { count } = await supabase
            .from("product_batches")
            .select("id", { count: "exact", head: true })
            .eq("product_id", item.product.id)
            .eq("status", "active")
            .gt("quantity", 0);

          if (!count || count === 0) {
            await supabase.from("products").update({ stock: newStock }).eq("id", item.product.id);
          }
        }
      }

      // Update customer balance
      const { error: balanceError } = await supabase
        .from("customers")
        .update({
          current_balance: customer.current_balance + total,
        })
        .eq("id", customer.id);
      if (balanceError) throw balanceError;

      // Create credit record
      const { error: creditError } = await supabase.from("credits").insert({
        sale_id: sale.id,
        customer_id: customer.id,
        customer_name: `${customer.name} ${customer.last_name || ""}`.trim(),
        customer_phone: customer.phone,
        total_amount: total,
        balance: total,
        paid_amount: 0,
        status: "pending",
      });
      if (creditError) throw creditError;
      const changeAmount = receivedAmount ? receivedAmount - total : 0;

      // Si es rehacer venta, anular la original
      if (originalSaleId) {
        await cancelOriginalSale(sale.id, sale.sale_number);
      }

      toast.success(
        `Venta #${sale.sale_number} completada${changeAmount > 0 ? ` - Cambio: $${changeAmount.toFixed(2)}` : ""}`,
      );
      setCart([]);
      setShowPaymentModal(false);
      return {
        saleId: sale.id,
      };
    } catch (error: any) {
      toast.error("Error al completar venta: " + error.message);
      throw error;
    }
  };
  const completeSale = async (
    paymentMethod: string,
    ticketType: string,
    cashAmount?: number,
    cardAmount?: number,
    receivedAmount?: number,
  ): Promise<
    | {
        saleId: string;
      }
    | undefined
  > => {
    if (isProcessingSaleRef.current) return;
    isProcessingSaleRef.current = true;
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    const total = getTotal();
    if (paymentMethod === "credit") {
      if (!selectedCustomer) {
        toast.error("Seleccione un cliente para venta a crédito");
        return;
      }
    }
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          cashier_id: user?.id,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          total,
          payment_method: paymentMethod,
          cash_amount: cashAmount || (paymentMethod === "cash" ? total : null),
          card_amount: cardAmount || (paymentMethod === "card" ? total : null),
          credit_amount: paymentMethod === "credit" ? total : null,
          cash_register_session_id: currentSession?.id || null,
        })
        .select()
        .single();
      if (saleError) throw saleError;
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id.startsWith("generic-") ? null : item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Procesar stock para cada item del carrito
      for (const item of cart) {
        if (item.product.id.startsWith("generic-")) continue; // Skip generic products
        if (!item.product.stock_disabled) {
          const previousStock = Math.max(0, item.product.stock);
          const newStock = Math.max(0, previousStock - item.quantity);

          // Registrar movimiento de stock (historial)
          await supabase.from("stock_movements").insert({
            product_id: item.product.id,
            movement_type: "sale",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: sale.id,
            performed_by: user?.id,
            notes: `Venta #${sale.sale_number}`,
          });

          // Descontar lotes FEFO (el trigger recalcula products.stock)
          await deductFromBatches(item.product.id, item.quantity);

          // Solo actualizar stock manual si NO tiene lotes activos
          const { count } = await supabase
            .from("product_batches")
            .select("id", { count: "exact", head: true })
            .eq("product_id", item.product.id)
            .eq("status", "active")
            .gt("quantity", 0);

          if (!count || count === 0) {
            await supabase.from("products").update({ stock: newStock }).eq("id", item.product.id);
          }
        }
      }
      if (paymentMethod === "credit" && selectedCustomer) {
        // Update customer balance
        const { error: balanceError } = await supabase
          .from("customers")
          .update({
            current_balance: selectedCustomer.current_balance + total,
          })
          .eq("id", selectedCustomer.id);
        if (balanceError) throw balanceError;

        // Create credit record
        const { error: creditError } = await supabase.from("credits").insert({
          sale_id: sale.id,
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          customer_phone: selectedCustomer.phone,
          total_amount: total,
          balance: total,
          paid_amount: 0,
          status: "pending",
        });
        if (creditError) throw creditError;
      }
      const changeAmount = receivedAmount ? receivedAmount - total : 0;

      // Si es rehacer venta, anular la original
      if (originalSaleId) {
        await cancelOriginalSale(sale.id, sale.sale_number);
      }

      toast.success(
        `Venta #${sale.sale_number} completada${changeAmount > 0 ? ` - Cambio: $${changeAmount.toFixed(2)}` : ""}`,
      );

      // Imprimir ticket
      printReceipt(sale, saleItems, ticketType, changeAmount);
      setCart([]);
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      return {
        saleId: sale.id,
      };
    } catch (error: any) {
      toast.error("Error al completar venta: " + error.message);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };
  const printReceipt = async (sale: any, saleItems: any[], ticketType: string, changeAmount: number) => {
    if (ticketType === "no_imprimir") return;
    try {
      // Obtener configuración de la empresa
      const { data: companySettings } = await supabase.from("company_settings").select("*").limit(1).single();

      // Preparar datos del cliente si existe
      let customerData = null;
      if (selectedCustomer) {
        customerData = {
          name: selectedCustomer.name,
          document: selectedCustomer.document,
          phone: selectedCustomer.phone,
          current_balance: selectedCustomer.current_balance,
        };
      }

      // Preparar datos de la caja
      const cashRegisterData = currentSession
        ? {
            name: currentSession.cash_registers?.name || "N/A",
            location: currentSession.cash_registers?.location,
          }
        : null;

      // Preparar datos de la venta con estructura completa
      const saleData = {
        sale_number: sale.sale_number,
        created_at: sale.created_at,
        total: sale.total,
        payment_method: sale.payment_method,
        cash_amount: sale.cash_amount,
        card_amount: sale.card_amount,
        credit_amount: sale.credit_amount,
        customer_name: sale.customer_name,
        cashier: {
          full_name: user?.user_metadata?.full_name || user?.email || "N/A",
        },
        customer: customerData,
        cash_register: cashRegisterData,
        session_id: currentSession?.id,
        notes: sale.notes,
        replaces_sale_number: originalSaleNumber || undefined,
      };

      // Preparar items
      const items = saleItems.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      // Preparar configuración de empresa
      const company = companySettings
        ? {
            company_name: companySettings.company_name,
            tax_id: companySettings.tax_id,
            address: companySettings.address,
            city: companySettings.city,
            phone: companySettings.phone,
            email: companySettings.email,
            currency: companySettings.currency,
            receipt_footer: companySettings.receipt_footer,
            logo_url: companySettings.logo_url,
          }
        : undefined;

      // Generar PDF según tipo de ticket
      if (ticketType === "a4") {
        await generateSaleA4PDF(saleData, items, company);
      } else {
        await generateSaleTicketPDF(saleData, items, company);
      }
    } catch (error) {
      console.error("Error generando recibo:", error);
      toast.error("Error al generar el comprobante");
    }
  };
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
                onClick={() => setShowExpenseDialog(true)}
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
