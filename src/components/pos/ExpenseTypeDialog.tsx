import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingCart } from "lucide-react";

interface ExpenseTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectExpense: () => void;
}

const ExpenseTypeDialog = ({ open, onClose, onSelectExpense }: ExpenseTypeDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué querés registrar?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-start gap-1"
            onClick={() => { onClose(); onSelectExpense(); }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <DollarSign className="h-5 w-5 text-primary" />
              Gasto / Retiro de Caja
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              Efectivo, servicios, retiros de caja
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-start gap-1"
            onClick={() => { onClose(); navigate("/admin/gastos?tab=ordenes&new=1&from=pos"); }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Orden de Compra
            </div>
            <span className="text-xs text-muted-foreground font-normal">
              Compra de productos a proveedor con lote
            </span>
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseTypeDialog;
