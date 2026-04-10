import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Check, PackageCheck, X, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PurchaseOrderDialog from "./PurchaseOrderDialog";
import PurchaseOrderDetailDialog from "./PurchaseOrderDetailDialog";
import { receivePurchaseOrder } from "@/hooks/usePurchaseOrderReception";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Borrador", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  received: { label: "Recibida", className: "bg-green-100 text-green-800 border-green-300" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-300" },
};

interface PurchaseOrdersTabProps {
  autoOpenNew?: boolean;
}

const PurchaseOrdersTab = ({ autoOpenNew = false }: PurchaseOrdersTabProps) => {
  const empresaId = useEmpresaId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cameFromPOS = searchParams.get("from") === "pos";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payingOrder, setPayingOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [receptionLoading, setReceptionLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenNew) {
      setDialogOpen(true);
    }
  }, [autoOpenNew]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:suppliers(name), items:purchase_order_items(id, product_id, product_name, quantity, unit_cost, expiration_date, precio_final)")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingOrder(null);
    if (refresh) {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", empresaId] });
    }
    if (cameFromPOS) {
      navigate("/pos");
    }
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleConfirmReception = async (order: any) => {
    if (!empresaId || !user) return;
    setReceptionLoading(order.id);
    try {
      await receivePurchaseOrder({
        orderId: order.id,
        orderNumber: order.order_number,
        empresaId,
        supplierId: order.supplier_id || (order.supplier as any)?.id,
        orderDate: order.order_date,
        total: Number(order.total),
        items: (order.items || []).map((i: any) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
          expiration_date: i.expiration_date || null,
          precio_final: Number(i.precio_final) || 0,
        })),
        userId: user.id,
      });
      toast.success(`Orden #${order.order_number} recibida — stock y gasto actualizados`);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", empresaId] });
    } catch (error: any) {
      toast.error("Error al confirmar recepción: " + error.message);
    } finally {
      setReceptionLoading(null);
    }
  };

  const handleCancelOrder = async (order: any) => {
    if (!empresaId) return;
    setCancelLoading(order.id);
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      toast.success(`Orden #${order.order_number} cancelada`);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", empresaId] });
    } catch (error: any) {
      toast.error("Error al cancelar la orden: " + error.message);
    } finally {
      setCancelLoading(null);
    }
  };

  const handleRegisterPayment = async () => {
    if (!payingOrder || !empresaId) return;
    setPaymentLoading(true);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          payment_method: paymentMethod,
          payment_status: "paid",
          expense_date: paymentDate,
        })
        .eq("notes", `Orden de compra #${payingOrder.order_number}`)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      toast.success(`Pago registrado para Orden #${payingOrder.order_number}`);
      setPaymentDialogOpen(false);
      setPayingOrder(null);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", empresaId] });
    } catch (error: any) {
      toast.error("Error al registrar el pago: " + error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Órdenes de Compra</h2>
        <Button onClick={() => { setEditingOrder(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Orden
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !orders?.length ? (
        <p className="text-center text-muted-foreground py-8">No hay órdenes de compra registradas</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Orden</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                const isPending = order.status === "pending";
                const isReceived = order.status === "received";
                return (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                    <TableCell className="font-medium">#{order.order_number}</TableCell>
                    <TableCell>{order.supplier?.name || "—"}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>${Number(order.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPending && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={receptionLoading === order.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmReception(order);
                            }}
                          >
                            <PackageCheck className="h-4 w-4 mr-1" />
                            {receptionLoading === order.id ? "Recibiendo..." : "Recibir"}
                          </Button>
                        )}
                        {isReceived && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingOrder(order);
                              setPaymentMethod("transfer");
                              setPaymentDate(new Date().toISOString().split("T")[0]);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleEdit(order); }}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        {isPending && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            disabled={cancelLoading === order.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelOrder(order);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {cancelLoading === order.id ? "Cancelando..." : "Cancelar"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PurchaseOrderDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        empresaId={empresaId}
        editingOrder={editingOrder}
      />

      <PurchaseOrderDetailDialog
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={detailOrder ? `Orden de Compra #${detailOrder.order_number}` : "Detalle"}
        data={detailOrder ? {
          supplier_name: detailOrder.supplier?.name || "—",
          date: detailOrder.order_date,
          total: detailOrder.total,
          status: detailOrder.status,
          notes: detailOrder.notes,
          items: (detailOrder.items || []).map((i: any) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
            expiration_date: i.expiration_date,
          })),
        } : null}
      />

      <Dialog open={paymentDialogOpen} onOpenChange={(v) => { if (!v) { setPaymentDialogOpen(false); setPayingOrder(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago — OC #{payingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input type="number" value={payingOrder?.total || 0} disabled className="bg-muted cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaymentDialogOpen(false); setPayingOrder(null); }} disabled={paymentLoading}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} disabled={paymentLoading}>
              {paymentLoading ? "Registrando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrdersTab;
