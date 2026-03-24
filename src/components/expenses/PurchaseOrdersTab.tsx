import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import PurchaseOrderDialog from "./PurchaseOrderDialog";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  received: { label: "Recibida", className: "bg-green-100 text-green-800 border-green-300" },
  cancelled: { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-300" },
};

interface PurchaseOrdersTabProps {
  autoOpenNew?: boolean;
}

const PurchaseOrdersTab = ({ autoOpenNew = false }: PurchaseOrdersTabProps) => {
  const empresaId = useEmpresaId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cameFromPOS = searchParams.get("from") === "pos";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

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
        .select("*, supplier:suppliers(name), items:purchase_order_items(id, product_name, quantity, unit_cost, expiration_date)")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    if (refresh) {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", empresaId] });
    }
    if (cameFromPOS) {
      navigate("/pos");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Órdenes de Compra</h2>
        <Button onClick={() => setDialogOpen(true)}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.order_number}</TableCell>
                    <TableCell>{order.supplier?.name || "—"}</TableCell>
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>{order.items?.length || 0}</TableCell>
                    <TableCell>${Number(order.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PurchaseOrderDialog open={dialogOpen} onClose={handleDialogClose} empresaId={empresaId} />
    </div>
  );
};

export default PurchaseOrdersTab;
