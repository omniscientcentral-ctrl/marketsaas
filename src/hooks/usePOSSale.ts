import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { CartItem, Customer, CashSession } from "./usePOSTypes";

interface UsePOSSaleParams {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  currentSession: CashSession | null;
  empresaId: string | null;
  user: User | null;
  originalSaleId: string | null;
  originalSaleNumber: number | null;
  cancelOriginalSale: (newSaleId: string, newSaleNumber: number) => Promise<void>;
  setCart: (items: CartItem[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  /** Called after a sale fully completes (e.g. close the payment modal). */
  onCompleteSale: () => void;
}

export function usePOSSale({
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
  onCompleteSale,
}: UsePOSSaleParams) {
  const isProcessingSaleRef = useRef(false);

  // Returns the credit available for a customer after subtracting pending sales
  const calculateAvailableCredit = async (customer: Customer): Promise<number> => {
    try {
      const { data: pendingSales, error } = await supabase
        .from("pending_sales")
        .select("total")
        .ilike("notes", `%${customer.name}%`);
      if (error) throw error;
      const pendingTotal = pendingSales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      return customer.credit_limit - (customer.current_balance + pendingTotal);
    } catch (error) {
      console.error("Error calculando disponible:", error);
      return customer.credit_limit - customer.current_balance;
    }
  };

  // Deducts quantity from batches using FEFO (First Expired, First Out)
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

  // Notifies all admin users when a credit sale exceeds the customer's limit
  const notifyAdminsAboutCreditExcess = async (
    customer: Customer,
    total: number,
    missingAmount: number,
    saleId: string,
  ) => {
    try {
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesError) throw rolesError;
      if (!adminRoles || adminRoles.length === 0) {
        console.log("No hay administradores para notificar");
        return;
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser?.id)
        .single();

      const { data: cashRegister } = await supabase
        .from("cash_register")
        .select("id")
        .eq("cashier_id", currentUser?.id)
        .eq("status", "open")
        .single();

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
            cashier_id: currentUser?.id,
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
      // Do not fail the sale if notification fails
    }
  };

  // Generates and opens a PDF receipt after a sale
  const printReceipt = async (
    sale: any,
    saleItems: any[],
    ticketType: string,
    changeAmount: number,
  ) => {
    if (ticketType === "no_imprimir") return;
    try {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, tax_id, address, city, phone, email, currency, receipt_footer, logo_url")
        .limit(1)
        .single();

      let customerData = null;
      if (selectedCustomer) {
        customerData = {
          name: selectedCustomer.name,
          document: selectedCustomer.document,
          phone: selectedCustomer.phone,
          current_balance: selectedCustomer.current_balance,
        };
      }

      const cashRegisterData = currentSession
        ? {
            name: currentSession.cash_registers?.name || "N/A",
            location: currentSession.cash_registers?.location,
          }
        : null;

      const saleData = {
        sale_number: sale.sale_number,
        created_at: sale.created_at,
        total: sale.total,
        payment_method: sale.payment_method,
        cash_amount: sale.cash_amount,
        card_amount: sale.card_amount,
        credit_amount: sale.credit_amount,
        transfer_amount: sale.transfer_amount,
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

      const items = saleItems.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

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

      const { generateSaleA4PDF, generateSaleTicketPDF } = await import("@/lib/pdfSaleGenerator");
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

  // Generates and opens a PDF receipt for a credit (fiado) sale — prints two copies
  const printCreditReceipt = async (
    saleId: string,
    customer: Customer,
    ticketType: string,
    showDebt: boolean = true,
  ) => {
    if (ticketType === "no_imprimir") return;

    try {
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .select(
          "sale_number, created_at, total, payment_method, cash_amount, card_amount, credit_amount, customer_name, notes",
        )
        .eq("id", saleId)
        .single();

      if (saleError || !saleData) {
        console.error("Error al obtener datos de venta:", saleError);
        return;
      }

      const { data: saleItems, error: itemsError } = await supabase
        .from("sale_items")
        .select("product_name, quantity, unit_price, subtotal")
        .eq("sale_id", saleId);

      if (itemsError) {
        console.error("Error al obtener items:", itemsError);
        return;
      }

      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, tax_id, address, city, phone, email, currency, receipt_footer, logo_url")
        .limit(1)
        .single();

      const { data: updatedCustomer } = await supabase
        .from("customers")
        .select("current_balance")
        .eq("id", customer.id)
        .single();

      const cashRegisterData = currentSession
        ? {
            name: currentSession.cash_registers?.name || "N/A",
            location: currentSession.cash_registers?.location,
          }
        : null;

      const customerData = {
        name: customer.name,
        last_name: customer.last_name,
        document: customer.document,
        rut: null,
        phone: customer.phone,
        address: customer.address,
        current_balance: showDebt
          ? (updatedCustomer?.current_balance ?? customer.current_balance)
          : undefined,
      };

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

      const items = (saleItems || []).map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

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

      const { generateSaleDualA4PDF, generateSaleTicketPDF } = await import("@/lib/pdfSaleGenerator");
      if (ticketType === "a4") {
        await generateSaleDualA4PDF(formattedSale, items, company);
      } else {
        // Two separate ticket prints: one for the business, one for the customer
        await generateSaleTicketPDF(formattedSale, items, company, "COPIA EMPRESA");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await generateSaleTicketPDF(formattedSale, items, company, "COPIA CLIENTE");
      }
    } catch (error) {
      console.error("Error generando recibos de crédito:", error);
    }
  };

  // Completes a sale for an explicit customer object (used for credit/fiado)
  const completeSaleForCustomer = async (
    paymentMethod: string,
    customer: Customer,
    cashAmount?: number,
    cardAmount?: number,
    receivedAmount?: number,
  ): Promise<{ saleId: string } | undefined> => {
    if (isProcessingSaleRef.current && paymentMethod !== "credit") return;
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!empresaId) {
      toast.error("Error: no se pudo determinar la empresa. Recargue la página.");
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const available = await calculateAvailableCredit(customer);
    const creditExceeded = paymentMethod === "credit" && available < total;

    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          cashier_id: user?.id,
          empresa_id: empresaId,
          customer_id: customer.id,
          customer_name: `${customer.name} ${customer.last_name || ""}`.trim(),
          total,
          payment_method: paymentMethod,
          cash_amount: cashAmount || (paymentMethod === "cash" ? total : null),
          card_amount: cardAmount || (paymentMethod === "card" ? total : null),
          credit_amount: paymentMethod === "credit" ? total : null,
          transfer_amount: paymentMethod === "transfer" ? total : null,
          notes: creditExceeded ? "credit_exceeded" : null,
          cash_register_session_id: currentSession?.id || null,
        })
        .select("id, sale_number, created_at, total, payment_method, cash_amount, card_amount, credit_amount, transfer_amount, customer_name")
        .single();
      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        empresa_id: empresaId,
        product_id: item.product.id.startsWith("generic-") ? null : item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
        iva_tipo: item.iva_tipo,
        iva_porcentaje: item.iva_porcentaje,
        utilidad_porcentaje: item.utilidad_porcentaje,
        costo_con_iva: item.costo_con_iva,
        precio_final: item.precio_final,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Deduct stock for each item
      for (const item of cart) {
        if (item.product.id.startsWith("generic-")) continue;
        if (!item.product.stock_disabled) {
          const previousStock = Math.max(0, item.product.stock);
          const newStock = Math.max(0, previousStock - item.quantity);

          await supabase.from("stock_movements").insert({
            product_id: item.product.id,
            empresa_id: empresaId,
            movement_type: "sale",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: sale.id,
            performed_by: user?.id,
            notes: `Venta #${sale.sale_number}`,
          });

          await deductFromBatches(item.product.id, item.quantity);

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
        .update({ current_balance: customer.current_balance + total })
        .eq("id", customer.id);
      if (balanceError) throw balanceError;

      // Create credit record
      const { error: creditError } = await supabase.from("credits").insert({
        sale_id: sale.id,
        empresa_id: empresaId,
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

      // If this is a redo, cancel the original sale
      if (originalSaleId) {
        await cancelOriginalSale(sale.id, sale.sale_number);
      }

      toast.success(
        `Venta #${sale.sale_number} completada${changeAmount > 0 ? ` - Cambio: $${changeAmount.toFixed(2)}` : ""}`,
      );
      setCart([]);
      onCompleteSale();
      return { saleId: sale.id };
    } catch (error: any) {
      toast.error("Error al completar venta: " + error.message);
      throw error;
    }
  };

  // Completes a sale using the currently selected customer (cash/card/credit/mixed)
  const completeSale = async (
    paymentMethod: string,
    ticketType: string,
    cashAmount?: number,
    cardAmount?: number,
    receivedAmount?: number,
  ): Promise<{ saleId: string } | undefined> => {
    if (isProcessingSaleRef.current) return;
    isProcessingSaleRef.current = true;

    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      isProcessingSaleRef.current = false;
      return;
    }
    if (!empresaId) {
      toast.error("Error: no se pudo determinar la empresa. Recargue la página.");
      isProcessingSaleRef.current = false;
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    if (paymentMethod === "credit") {
      if (!selectedCustomer) {
        toast.error("Seleccione un cliente para venta a crédito");
        isProcessingSaleRef.current = false;
        return;
      }
    }

    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          cashier_id: user?.id,
          empresa_id: empresaId,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          total,
          payment_method: paymentMethod,
          cash_amount: cashAmount || (paymentMethod === "cash" ? total : null),
          card_amount: cardAmount || (paymentMethod === "card" ? total : null),
          credit_amount: paymentMethod === "credit" ? total : null,
          transfer_amount: paymentMethod === "transfer" ? total : null,
          cash_register_session_id: currentSession?.id || null,
        })
        .select("id, sale_number, created_at, total, payment_method, cash_amount, card_amount, credit_amount, transfer_amount, customer_name")
        .single();
      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        empresa_id: empresaId,
        product_id: item.product.id.startsWith("generic-") ? null : item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
        iva_tipo: item.iva_tipo,
        iva_porcentaje: item.iva_porcentaje,
        utilidad_porcentaje: item.utilidad_porcentaje,
        costo_con_iva: item.costo_con_iva,
        precio_final: item.precio_final,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Deduct stock for each item
      for (const item of cart) {
        if (item.product.id.startsWith("generic-")) continue;
        if (!item.product.stock_disabled) {
          const previousStock = Math.max(0, item.product.stock);
          const newStock = Math.max(0, previousStock - item.quantity);

          await supabase.from("stock_movements").insert({
            product_id: item.product.id,
            empresa_id: empresaId,
            movement_type: "sale",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: sale.id,
            performed_by: user?.id,
            notes: `Venta #${sale.sale_number}`,
          });

          await deductFromBatches(item.product.id, item.quantity);

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
        const { error: balanceError } = await supabase
          .from("customers")
          .update({ current_balance: selectedCustomer.current_balance + total })
          .eq("id", selectedCustomer.id);
        if (balanceError) throw balanceError;

        const { error: creditError } = await supabase.from("credits").insert({
          sale_id: sale.id,
          empresa_id: empresaId,
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

      // If this is a redo, cancel the original sale
      if (originalSaleId) {
        await cancelOriginalSale(sale.id, sale.sale_number);
      }

      // Validar y normalizar created_at antes de generar el PDF
      if (sale.created_at) {
        const parsedDate = new Date(sale.created_at as any);
        if (isNaN(parsedDate.getTime())) {
          console.warn("created_at inválido, usando fecha actual", sale.created_at);
          sale.created_at = new Date().toISOString();
        } else {
          sale.created_at = parsedDate.toISOString();
        }
      }

      toast.success(
        `Venta #${sale.sale_number} completada${changeAmount > 0 ? ` - Cambio: $${changeAmount.toFixed(2)}` : ""}`,
      );

      printReceipt(sale, saleItems, ticketType, changeAmount);
      setCart([]);
      setSelectedCustomer(null);
      onCompleteSale();
      return { saleId: sale.id };
    } catch (error: any) {
      toast.error("Error al completar venta: " + error.message);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };

  return {
    isProcessingSaleRef,
    calculateAvailableCredit,
    notifyAdminsAboutCreditExcess,
    printCreditReceipt,
    completeSale,
    completeSaleForCustomer,
  };
}
