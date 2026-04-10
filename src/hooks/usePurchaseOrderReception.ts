import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReceptionItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  expiration_date: string | null;
  precio_final?: number;
}

interface ReceptionParams {
  orderId: string;
  orderNumber: number;
  empresaId: string;
  supplierId: string;
  orderDate: string;
  total: number;
  items: ReceptionItem[];
  userId: string;
}

export const receivePurchaseOrder = async (params: ReceptionParams) => {
  const { orderId, orderNumber, empresaId, supplierId, orderDate, total, items, userId } = params;

  // 1. Update status to received
  const { error: statusError } = await supabase
    .from("purchase_orders")
    .update({ status: "received" })
    .eq("id", orderId);
  if (statusError) throw statusError;

  // 2. Insert product batches
  const batches = items.map((i) => ({
    product_id: i.product_id,
    empresa_id: empresaId,
    supplier_id: supplierId,
    quantity: Number(i.quantity),
    initial_quantity: Number(i.quantity),
    cost: Number(i.unit_cost),
    expiration_date: i.expiration_date || null,
    batch_number: `OC-${orderNumber}`,
    status: "active",
    created_by: userId,
  }));

  const { error: batchError } = await supabase.from("product_batches").insert(batches);
  if (batchError) throw batchError;

  // 3. Insert expense
  const { error: expenseError } = await supabase.from("expenses").insert({
    empresa_id: empresaId,
    supplier_id: supplierId,
    amount: total,
    payment_method: "transfer",
    payment_status: "pending",
    expense_date: orderDate,
    notes: `Orden de compra #${orderNumber}`,
    created_by: userId,
  });
  if (expenseError) throw expenseError;

  // 4. Update product prices and sync stock balance
  for (const item of items) {
    if (item.precio_final && Number(item.precio_final) > 0) {
      await supabase
        .from("products")
        .update({ price: Number(item.precio_final) })
        .eq("id", item.product_id)
        .eq("empresa_id", empresaId);
    }

    const { data: updatedProduct } = await supabase
      .from("products")
      .select("stock")
      .eq("id", item.product_id)
      .single();
    if (updatedProduct) {
      await supabase.from("product_stock_balance").upsert(
        {
          product_id: item.product_id,
          current_balance: updatedProduct.stock,
          last_movement_at: new Date().toISOString(),
        },
        { onConflict: "product_id" }
      );
    }
  }
};
