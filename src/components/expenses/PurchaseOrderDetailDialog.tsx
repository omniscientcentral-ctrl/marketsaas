import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface DetailItem {
  product_name: string;
  quantity: number;
  unit_cost: number;
  expiration_date: string | null;
}

interface DetailData {
  supplier_name: string;
  date: string;
  total: number;
  status?: string;
  notes?: string | null;
  items: DetailItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: DetailData | null;
  loading?: boolean;
  title?: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  received: { label: "Recibida", className: "bg-green-100 text-green-800 border-green-300" },
  paid: { label: "Pagado", className: "bg-green-100 text-green-800 border-green-300" },
};

const PurchaseOrderDetailDialog = ({ open, onClose, data, loading = false, title = "Detalle" }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? null : (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Proveedor</p>
                <p className="font-medium">{data.supplier_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {format(new Date(data.date), "dd/MM/yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">
                  ${Number(data.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {data.status && (
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge variant="outline" className={statusLabels[data.status]?.className}>
                    {statusLabels[data.status]?.label || data.status}
                  </Badge>
                </div>
              )}
              {data.notes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Notas</p>
                  <p className="font-medium">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Items */}
            {data.items.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Gasto sin detalle de productos
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo Unit.</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead>Vencimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          ${Number(item.unit_cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          ${(item.quantity * item.unit_cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {item.expiration_date
                            ? format(new Date(item.expiration_date), "dd/MM/yyyy", { locale: es })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrderDetailDialog;
