import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Trash2, Eye, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Expense } from "./ExpensesTab";
import ReceiptPreviewDialog from "./ReceiptPreviewDialog";
import PurchaseOrderDetailDialog from "./PurchaseOrderDetailDialog";
import { supabase } from "@/integrations/supabase/client";

interface ExpensesTableProps {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

const ExpensesTable = ({ expenses, loading, onEdit, onDelete }: ExpensesTableProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState("Detalle");

  const handleDeleteClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedExpense) {
      onDelete(selectedExpense);
    }
    setDeleteDialogOpen(false);
    setSelectedExpense(null);
  };

  const handleViewReceipt = (url: string) => {
    setPreviewUrl(url);
    setReceiptPreviewOpen(true);
  };

  const handleViewDetail = async (expense: Expense) => {
    setDetailOpen(true);
    setDetailTitle(`Gasto — ${expense.supplier?.name || "Sin proveedor"}`);

    if (expense.notes?.startsWith("Orden de compra #")) {
      const orderNumber = expense.notes.replace("Orden de compra #", "").trim();
      setDetailLoading(true);
      try {
        const { data: orders } = await supabase
          .from("purchase_orders")
          .select("*, items:purchase_order_items(product_name, quantity, unit_cost, expiration_date)")
          .eq("order_number", Number(orderNumber))
          .order("created_at", { ascending: false })
          .limit(1);

        const order = orders?.[0];

        setDetailData({
          supplier_name: expense.supplier?.name || "—",
          date: expense.expense_date,
          total: expense.amount,
          status: expense.payment_status,
          notes: expense.notes,
          items: order?.items || [],
        });
      } catch {
        setDetailData({
          supplier_name: expense.supplier?.name || "—",
          date: expense.expense_date,
          total: expense.amount,
          status: expense.payment_status,
          notes: expense.notes,
          items: [],
        });
      } finally {
        setDetailLoading(false);
      }
    } else {
      setDetailData({
        supplier_name: expense.supplier?.name || "—",
        date: expense.expense_date,
        total: expense.amount,
        status: expense.payment_status,
        notes: expense.notes,
        items: [],
      });
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: "Efectivo",
      transfer: "Transferencia",
      card: "Tarjeta",
      credit: "Crédito",
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay gastos registrados</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: es })}
                </TableCell>
                <TableCell className="font-medium">
                  {expense.supplier?.name || "N/A"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${Number(expense.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={expense.payment_status === "paid" ? "default" : "secondary"}
                    className={
                      expense.payment_status === "paid"
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                    }
                  >
                    {expense.payment_status === "paid" ? "Pagado" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell>{getPaymentMethodLabel(expense.payment_method)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {expense.invoice_number || "-"}
                    </span>
                    {expense.notes?.startsWith("Orden de compra #") && (
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                        {expense.notes}
                      </Badge>
                    )}
                    {expense.receipt_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleViewReceipt(expense.receipt_url!)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetail(expense)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(expense)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(expense)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Preview */}
      <ReceiptPreviewDialog
        open={receiptPreviewOpen}
        onClose={() => setReceiptPreviewOpen(false)}
        imageUrl={previewUrl}
      />

      {/* Detail Dialog */}
      <PurchaseOrderDetailDialog
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailData(null); }}
        data={detailData}
        loading={detailLoading}
        title={detailTitle}
      />
    </>
  );
};

export default ExpensesTable;
