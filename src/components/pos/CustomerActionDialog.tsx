import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, ShoppingCart, Wallet, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  document: string | null;
  phone: string | null;
  credit_limit: number;
  current_balance: number;
  status: string;
}

interface CustomerActionDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  cartTotal: number;
  onFiar: () => Promise<void>;
  onPayPartial: () => void;
  onPayTotal: () => void;
}

const CustomerActionDialog = ({ 
  open, 
  onClose, 
  customer,
  cartTotal,
  onFiar,
  onPayPartial,
  onPayTotal
}: CustomerActionDialogProps) => {
  if (!customer) return null;

  const available = customer.credit_limit - customer.current_balance;
  const hasDebt = customer.current_balance > 0;
  const hasCredit = customer.credit_limit > 0;
  const wouldExceedLimit = (customer.current_balance + cartTotal) > customer.credit_limit;
  const canFiar = hasCredit && !wouldExceedLimit;

  // Keyboard shortcuts
  const handleKeyDown = async (e: KeyboardEvent) => {
    if (!open) return;
    
    switch(e.key) {
      case '1':
        if (canFiar) await onFiar();
        break;
      case '2':
        if (cartTotal > 0) onPayPartial();
        break;
      case '3':
        if (hasDebt) onPayTotal();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, canFiar, hasDebt, cartTotal]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opciones para {customer.name} {customer.last_name || ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Límite de Crédito:</span>
              <span className="font-medium">${customer.credit_limit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deuda Actual:</span>
              <span className="font-medium text-warning">
                ${customer.current_balance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Disponible:</span>
              <span className={`font-medium ${available < 0 ? "text-destructive" : "text-success"}`}>
                ${available.toFixed(2)}
              </span>
            </div>
            {customer.current_balance > customer.credit_limit && (
              <Badge variant="destructive" className="w-full justify-center">
                Cliente en mora
              </Badge>
            )}
          </div>

          {/* Warnings */}
          {!hasCredit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cliente sin crédito habilitado
              </AlertDescription>
            </Alert>
          )}

          {wouldExceedLimit && hasCredit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Crédito excedido (Total: ${(customer.current_balance + cartTotal).toFixed(2)}). Se requiere autorización de Supervisor.
              </AlertDescription>
            </Alert>
          )}

          {cartTotal > 0 && (
            <div className="bg-secondary/50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total del carrito:</span>
                <span className="font-bold">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-2 hover:bg-secondary hover:border-primary transition-all"
              onClick={onFiar}
              disabled={!canFiar}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-6 w-6" />
                <span className="font-semibold text-lg">💳 Fiar</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Venta a crédito nueva (Atajo: 1)
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-2 hover:bg-secondary hover:border-primary transition-all"
              onClick={onPayPartial}
              disabled={cartTotal === 0}
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-6 w-6" />
                <span className="font-semibold text-lg">💰 Pagar Parcial y hacer la venta</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Pago parcial antes de completar venta (Atajo: 2)
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-2 hover:bg-secondary hover:border-primary transition-all"
              onClick={onPayTotal}
              disabled={!hasDebt}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-6 w-6" />
                <span className="font-semibold text-lg">🧾 Pagar deuda total</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Pagar toda la deuda sin venta (Atajo: 3)
              </span>
            </Button>
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerActionDialog;
