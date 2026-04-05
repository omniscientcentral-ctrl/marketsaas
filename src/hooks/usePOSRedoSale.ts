import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CartItem, Customer } from "./usePOSTypes";

export function usePOSRedoSale(
  setCart: (items: CartItem[]) => void,
  setSelectedCustomer: (customer: Customer | null) => void,
  userId: string | undefined,
) {
  const [originalSaleId, setOriginalSaleId] = useState<string | null>(null);
  const [originalSaleNumber, setOriginalSaleNumber] = useState<number | null>(null);

  // On mount: detect and load "redo sale" data placed by the Sales page
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

        // Fetch up-to-date product data from DB
        const productIds = redoData.items
          .filter((i: any) => i.product_id)
          .map((i: any) => i.product_id);

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
          const dbProduct = item.product_id
            ? dbProducts.find((p: any) => p.id === item.product_id)
            : null;

          if (dbProduct) {
            return {
              product: {
                id: dbProduct.id,
                name: dbProduct.name,
                price: item.unit_price, // preserve original sale price
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
            .select("id, name, last_name, document, phone, address, credit_limit, current_balance, status")
            .eq("id", redoData.customerId)
            .single();
          if (customer) {
            setSelectedCustomer(customer as any);
          }
        }

        toast.info(
          `Venta #${redoData.originalSaleNumber} cargada. Modificá y cobrá para reemplazarla.`,
        );
      } catch (e) {
        console.error("Error loading redo sale data:", e);
      }
    };
    loadRedoSale();
  }, []);

  // Cancels the original sale and reverts its stock after a redo completes
  const cancelOriginalSale = async (newSaleId: string, newSaleNumber: number) => {
    if (!originalSaleId) return;

    try {
      // 1. Fetch items of the original sale to revert stock
      const { data: originalItems } = await supabase
        .from("sale_items")
        .select("product_id, quantity, product_name")
        .eq("sale_id", originalSaleId);

      // 2. Fetch the original sale record
      const { data: originalSale } = await supabase
        .from("sales")
        .select("id, sale_number, customer_id, credit_amount, status, total")
        .eq("id", originalSaleId)
        .single();

      if (!originalSale) throw new Error("Venta original no encontrada");

      // 3. Revert stock for each item
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

          // Prefer updating the active batch so the DB trigger recalculates stock
          const { data: activeBatch } = await supabase
            .from("product_batches")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeBatch) {
            await supabase
              .from("product_batches")
              .update({ quantity: activeBatch.quantity + item.quantity })
              .eq("id", activeBatch.id);
          } else {
            await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", item.product_id);
          }

          // Record the return movement
          await supabase.from("stock_movements").insert({
            product_id: item.product_id,
            movement_type: "sale_redo_return",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: originalSaleId,
            performed_by: userId,
            notes: `Devolución por rehacer venta #${originalSaleNumber} → #${newSaleNumber}`,
          });
        }
      }

      // 4. If the original sale had credit, cancel it and recalculate balance
      if ((originalSale.credit_amount ?? 0) > 0 && originalSale.customer_id) {
        await supabase
          .from("credits")
          .update({ status: "cancelled", balance: 0 })
          .eq("sale_id", originalSaleId);

        const { data: activeCredits } = await supabase
          .from("credits")
          .select("balance")
          .eq("customer_id", originalSale.customer_id)
          .in("status", ["pending", "partial"]);

        const recalculatedBalance = (activeCredits || []).reduce(
          (sum: number, c: any) => sum + (c.balance ?? 0),
          0,
        );

        await supabase
          .from("customers")
          .update({ current_balance: recalculatedBalance })
          .eq("id", originalSale.customer_id);
      }

      // 5. Mark the original sale as cancelled
      await (supabase as any)
        .from("sales")
        .update({
          status: "cancelled",
          notes: `Anulada y reemplazada por venta #${newSaleNumber}`,
        })
        .eq("id", originalSaleId);

      // 6. Link the new sale back to the original
      await (supabase as any)
        .from("sales")
        .update({ replaces_sale_id: originalSaleId })
        .eq("id", newSaleId);

      setOriginalSaleId(null);
      setOriginalSaleNumber(null);
    } catch (error: any) {
      console.error("Error al anular venta original:", error);
      toast.error("Error al anular la venta original: " + error.message);
    }
  };

  return {
    originalSaleId,
    originalSaleNumber,
    setOriginalSaleId,
    setOriginalSaleNumber,
    cancelOriginalSale,
  };
}
