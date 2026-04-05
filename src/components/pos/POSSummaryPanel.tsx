import { Clock, User, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Customer } from "@/hooks/usePOSTypes";

interface POSSummaryPanelProps {
  totalItems: number;
  subtotal: number;
  total: number;
  selectedCustomer: Customer | null;
  cartIsEmpty: boolean;
  isPOSBlocked: boolean;
  isDebtPaymentMode: boolean;
  isF12Disabled: boolean;
  onClearCustomer: () => void;
  onSavePending: () => void;
  onOpenCustomerDialog: () => void;
  onCobrar: () => void;
}

export function POSSummaryPanel({
  totalItems,
  subtotal,
  total,
  selectedCustomer,
  cartIsEmpty,
  isPOSBlocked,
  isDebtPaymentMode,
  isF12Disabled,
  onClearCustomer,
  onSavePending,
  onOpenCustomerDialog,
  onCobrar,
}: POSSummaryPanelProps) {
  return (
    <div className="space-y-6">
      {/* Totals */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Items</p>
            <p className="text-4xl font-bold">{totalItems}</p>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA incluido:</span>
              <span className="font-medium">$0.00</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-lg font-medium">Total:</span>
            <span className="text-3xl font-bold text-primary">${total.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Customer Info */}
      {selectedCustomer && (
        <Card className="p-4 bg-secondary/50">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">{selectedCustomer.name}</p>
            <Button variant="ghost" size="sm" onClick={onClearCustomer}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Límite:</span>
              <span>${selectedCustomer.credit_limit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deuda:</span>
              <span className="text-warning">${selectedCustomer.current_balance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disponible:</span>
              <span className="text-success">
                ${(selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={onSavePending}
          disabled={cartIsEmpty || isPOSBlocked}
        >
          <Clock className="mr-2 h-5 w-5" />
          Poner en Espera (F7)
        </Button>

        <Button
          variant="outline"
          className="w-full h-12"
          onClick={onOpenCustomerDialog}
          disabled={isPOSBlocked}
        >
          <User className="mr-2 h-5 w-5" />
          Crédito / Fiado (F5)
        </Button>

        <Button
          variant={isDebtPaymentMode ? "secondary" : "default"}
          className="w-full h-14 text-lg"
          onClick={onCobrar}
          disabled={isF12Disabled || isPOSBlocked}
        >
          {isDebtPaymentMode ? (
            <>
              <DollarSign className="mr-2 h-5 w-5" />
              💰 Pagar Deuda (F12)
            </>
          ) : (
            <>💸 Cobrar (F12)</>
          )}
        </Button>
      </div>
    </div>
  );
}
