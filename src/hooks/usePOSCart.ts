import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { EXPIRATION_THRESHOLDS } from "@/hooks/useProductExpiration";
import type { Product, CartItem } from "./usePOSTypes";

export function usePOSCart(
  userId: string | undefined,
  activeRole: string | null | undefined,
) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem("pos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [canEditPrice, setCanEditPrice] = useState(false);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});

  // Persist cart to sessionStorage
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

  // Load price-edit permission for this user
  useEffect(() => {
    if (!userId) return;
    const fetchPricePermission = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("can_edit_price")
        .eq("id", userId)
        .single();
      setCanEditPrice(data?.can_edit_price || false);
    };
    fetchPricePermission();
  }, [userId]);

  const addToCart = useCallback(
    async (product: Product, quantity: number = 1) => {
      // Fetch real-time stock from the balance view
      const { data: balanceData } = await supabase
        .from("product_stock_balance")
        .select("current_balance")
        .eq("product_id", product.id)
        .maybeSingle();
      const currentStock = balanceData?.current_balance ?? 0;
      const updatedProduct = { ...product, stock: currentStock };

      // Check for batches expiring within the notice window
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
              ? { ...item, product: updatedProduct, quantity: newQuantity, expirationInfo }
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

  const handleQuantityInputChange = (productId: string, value: string) => {
    setQuantityInputs((prev) => ({ ...prev, [productId]: value }));
  };

  const commitQuantityInput = (productId: string) => {
    const raw = quantityInputs[productId];
    if (raw === undefined) return;

    const sanitized = raw.replace(",", ".");
    const parsed = parseFloat(sanitized);
    if (Number.isNaN(parsed)) {
      setQuantityInputs((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }
    if (parsed <= 0) {
      updateQuantity(productId, 0.01);
    } else {
      updateQuantity(productId, parsed);
    }

    setQuantityInputs((prev) => {
      const next = { ...prev };
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

    setCart((prevCart) =>
      prevCart.map((i) =>
        i.product.id === productId
          ? { ...i, product: { ...i.product, price: newPrice } }
          : i,
      ),
    );

    toast.success("Precio actualizado para esta venta");

    try {
      const { error: logError } = await supabase.from("price_override_logs").insert({
        user_id: userId,
        product_id: productId,
        original_price: originalPrice,
        new_price: newPrice,
        sale_id: null,
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

  // Clears only the cart; callers are responsible for clearing related state (e.g. selectedCustomer)
  const clearCart = () => setCart([]);

  const getSubtotal = () =>
    cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const getTotal = () => getSubtotal(); // IVA incluido en precio
  const getTotalItems = () =>
    cart.reduce((sum, item) => sum + Math.ceil(item.quantity), 0);

  return {
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
    clearCart,
    getSubtotal,
    getTotal,
    getTotalItems,
  };
}
