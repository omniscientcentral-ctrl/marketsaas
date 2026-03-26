import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  expiration_date: string;
}

interface Props {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  empresaId: string | null;
  editingOrder?: any;
}

const PurchaseOrderDialog = ({ open, onClose, empresaId, editingOrder }: Props) => {
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; cost: number | null }[]>([]);

  const isEditing = !!editingOrder;

  useEffect(() => {
    if (open && empresaId) {
      loadData();
      if (editingOrder) {
        setSupplierId(editingOrder.supplier_id);
        setOrderDate(editingOrder.order_date);
        setNotes(editingOrder.notes || "");
        setItems(
          (editingOrder.items || []).map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: Number(i.quantity),
            unit_cost: Number(i.unit_cost),
            expiration_date: i.expiration_date || "",
          }))
        );
      } else {
        resetForm();
      }
    }
  }, [open, empresaId, editingOrder]);

  const loadData = async () => {
    if (!empresaId) return;
    const [suppRes, prodRes] = await Promise.all([
      supabase.from("suppliers").select("id, name").eq("empresa_id", empresaId).eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, cost").eq("empresa_id", empresaId).eq("active", true).order("name"),
    ]);
    setSuppliers(suppRes.data || []);
    setProducts(prodRes.data || []);
  };

  const resetForm = () => {
    setSupplierId("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setItems([]);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", product_name: "", quantity: 1, unit_cost: 0, expiration_date: "" }]);
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...items];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        product_id: value,
        product_name: product?.name || "",
        unit_cost: product?.cost || 0,
      };
    } else {
      (updated[index] as any)[field] = value;
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0),
    [items],
  );

  const handleSubmit = async () => {
    if (!supplierId) {
      toast.error("Seleccioná un proveedor");
      return;
    }
    const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Agregá al menos un producto con cantidad mayor a 0");
      return;
    }
    if (!empresaId || !user) return;

    setLoading(true);
    try {
      // 1. Insert purchase order
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          empresa_id: empresaId,
          supplier_id: supplierId,
          order_date: orderDate,
          notes: notes || null,
          total,
          created_by: user.id,
          status: "received",
        } as any)
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items (NO incluir subtotal — es columna GENERATED)
      const orderItems = validItems.map((i) => ({
        purchase_order_id: order.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
        expiration_date: i.expiration_date || null,
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(orderItems as any);
      if (itemsError) throw itemsError;

      // 3. Insert product batches for each item
      const batches = validItems.map((i) => ({
        product_id: i.product_id,
        empresa_id: empresaId,
        supplier_id: supplierId,
        quantity: Number(i.quantity),
        initial_quantity: Number(i.quantity),
        cost: Number(i.unit_cost),
        expiration_date: i.expiration_date || "2099-12-31",
        batch_number: `OC-${(order as any).order_number}`,
        status: "active",
        created_by: user.id,
      }));

      const { error: batchError } = await supabase.from("product_batches").insert(batches);
      if (batchError) throw batchError;

      // 4. Insert expense
      const { error: expenseError } = await supabase.from("expenses").insert({
        empresa_id: empresaId,
        supplier_id: supplierId,
        amount: total,
        payment_method: "transfer",
        payment_status: "pending",
        expense_date: orderDate,
        notes: `Orden de compra #${(order as any).order_number}`,
        created_by: user.id,
      });
      if (expenseError) throw expenseError;

      // 5. Sync product_stock_balance
      for (const item of validItems) {
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

      toast.success("Orden de compra registrada");
      onClose(true);
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      toast.error("Error al crear la orden: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!supplierId) {
      toast.error("Seleccioná un proveedor");
      return;
    }
    const validItems = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Agregá al menos un producto con cantidad mayor a 0");
      return;
    }
    if (!empresaId || !user || !editingOrder) return;

    setLoading(true);
    try {
      const batchTag = `OC-${editingOrder.order_number}`;
      const expenseTag = `Orden de compra #${editingOrder.order_number}`;

      // 0. Verificar que no haya lotes consumidos parcialmente
      const { data: existingBatches } = await supabase
        .from("product_batches")
        .select("id, quantity, initial_quantity, product_id")
        .eq("batch_number", batchTag)
        .eq("empresa_id", empresaId);

      if (existingBatches?.some((b) => Number(b.quantity) < Number(b.initial_quantity))) {
        toast.error("No se puede editar — esta orden tiene lotes con stock ya consumido");
        setLoading(false);
        return;
      }

      // Collect all affected product IDs (old + new) for stock sync later
      const oldProductIds = (existingBatches || []).map((b) => b.product_id);
      const newProductIds = validItems.map((i) => i.product_id);
      const allAffectedProductIds = [...new Set([...oldProductIds, ...newProductIds])];

      // 1. Update purchase order header
      const { error: orderError } = await supabase
        .from("purchase_orders")
        .update({
          supplier_id: supplierId,
          order_date: orderDate,
          notes: notes || null,
          total,
        })
        .eq("id", editingOrder.id);
      if (orderError) throw orderError;

      // 2. Delete old items and insert new ones (subtotal es GENERATED — no incluir)
      const { error: deleteItemsError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("purchase_order_id", editingOrder.id);
      if (deleteItemsError) throw deleteItemsError;

      const { error: insertItemsError } = await supabase
        .from("purchase_order_items")
        .insert(
          validItems.map((i) => ({
            purchase_order_id: editingOrder.id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: Number(i.quantity),
            unit_cost: Number(i.unit_cost),
            expiration_date: i.expiration_date || null,
          })) as any
        );
      if (insertItemsError) throw insertItemsError;

      // 3. Reconciliar lotes: borrar viejos y crear nuevos
      const { error: deleteBatchError } = await supabase
        .from("product_batches")
        .delete()
        .eq("batch_number", batchTag)
        .eq("empresa_id", empresaId);
      if (deleteBatchError) throw deleteBatchError;

      const { error: insertBatchError } = await supabase
        .from("product_batches")
        .insert(
          validItems.map((i) => ({
            product_id: i.product_id,
            empresa_id: empresaId,
            supplier_id: supplierId,
            quantity: Number(i.quantity),
            initial_quantity: Number(i.quantity),
            cost: Number(i.unit_cost),
            expiration_date: i.expiration_date || "2099-12-31",
            batch_number: batchTag,
            status: "active",
            created_by: user.id,
          }))
        );
      if (insertBatchError) throw insertBatchError;

      // 4. Actualizar gasto vinculado (eq exacto por notes)
      const { error: expenseError } = await supabase
        .from("expenses")
        .update({
          supplier_id: supplierId,
          amount: total,
          expense_date: orderDate,
        })
        .eq("notes", expenseTag)
        .eq("empresa_id", empresaId);
      if (expenseError) throw expenseError;

      // 5. Sincronizar product_stock_balance para todos los productos afectados
      for (const productId of allAffectedProductIds) {
        const { data: updatedProduct } = await supabase
          .from("products")
          .select("stock")
          .eq("id", productId)
          .single();
        if (updatedProduct) {
          await supabase.from("product_stock_balance").upsert(
            {
              product_id: productId,
              current_balance: updatedProduct.stock,
              last_movement_at: new Date().toISOString(),
            },
            { onConflict: "product_id" }
          );
        }
      }

      toast.success("Orden de compra actualizada");
      onClose(true);
    } catch (error: any) {
      console.error("Error updating purchase order:", error);
      toast.error("Error al actualizar la orden: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Orden de Compra" : "Nueva Orden de Compra"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Proveedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Productos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar producto
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3">
                <div className="col-span-12 md:col-span-4">
                  <Label className="text-xs">Producto</Label>
                  <Select value={item.product_id} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-xs">Costo Unit.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_cost}
                    onChange={(e) => updateItem(idx, "unit_cost", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <Label className="text-xs">Vencimiento</Label>
                  <Input
                    type="date"
                    value={item.expiration_date}
                    onChange={(e) => updateItem(idx, "expiration_date", e.target.value)}
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Agregá productos a la orden</p>
            )}
          </div>

          <div className="flex justify-end text-lg font-semibold">
            Total: ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={isEditing ? handleUpdate : handleSubmit} disabled={loading}>
            {loading ? "Guardando..." : isEditing ? "Actualizar Orden" : "Guardar Orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrderDialog;
