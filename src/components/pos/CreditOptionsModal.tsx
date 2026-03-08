import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, DollarSign, X, AlertCircle, Printer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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

interface CreditOptionsModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  cartTotal: number;
  onFiar: (ticketType: string, showDebt: boolean) => Promise<void>;
  onPayPartial: () => void;
  onPayTotal: () => void;
}

const CreditOptionsModal = ({ 
  open, 
  onClose, 
  customer,
  cartTotal,
  onFiar,
  onPayPartial,
  onPayTotal
}: CreditOptionsModalProps) => {
  const [available, setAvailable] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ticketType, setTicketType] = useState(() => {
    return localStorage.getItem('creditTicketType') || 'tickeadora';
  });
  const [showDebtOnPrint, setShowDebtOnPrint] = useState(() => {
    return localStorage.getItem('creditShowDebt') !== 'false';
  });

  const handleTicketTypeChange = (value: string) => {
    setTicketType(value);
    localStorage.setItem('creditTicketType', value);
  };

  const handleShowDebtChange = (checked: boolean) => {
    setShowDebtOnPrint(checked);
    localStorage.setItem('creditShowDebt', String(checked));
  };

  useEffect(() => {
    if (open && customer) {
      calculateAvailable();
    }
    if (!open) {
      setProcessing(false);
    }
  }, [open, customer]);

  const calculateAvailable = async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      // Obtener ventas en espera del cliente
      const { data: pendingSales, error } = await supabase
        .from("pending_sales")
        .select("total")
        .ilike("notes", `%${customer.name}%`);

      if (error) throw error;

      const pending = pendingSales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      setPendingTotal(pending);
      
      const availableCredit = customer.credit_limit - (customer.current_balance + pending);
      setAvailable(availableCredit);
    } catch (error) {
      console.error("Error calculando disponible:", error);
      setAvailable(customer.credit_limit - customer.current_balance);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      switch(e.key) {
        case '1':
          if (processing) break;
          setProcessing(true);
          await onFiar(ticketType, showDebtOnPrint);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, available, customer]);

  if (!customer) return null;

  const hasDebt = customer.current_balance > 0;
  const hasCredit = customer.credit_limit > 0;
  const wouldExceedLimit = (customer.current_balance + cartTotal) > customer.credit_limit;
  const canFiar = available >= cartTotal;
  const faltante = cartTotal - available;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opciones de Crédito - {customer.name} {customer.last_name || ""}</DialogTitle>
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
            {pendingTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">En Espera:</span>
                <span className="font-medium text-muted-foreground">
                  ${pendingTotal.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground font-semibold">Disponible:</span>
              <span className={`font-bold ${available < 0 ? "text-destructive" : "text-success"}`}>
                ${available.toFixed(2)}
              </span>
            </div>
            {customer.current_balance > customer.credit_limit && (
              <Badge variant="destructive" className="w-full justify-center">
                Cliente en mora
              </Badge>
            )}
          </div>

          {/* Cart Total */}
          {cartTotal > 0 && (
            <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total del carrito:</span>
                <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {!hasCredit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cliente sin crédito habilitado
              </AlertDescription>
            </Alert>
          )}

          {!canFiar && hasCredit && faltante > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Faltan ${faltante.toFixed(2)} para cubrir el total. La venta se procesará y se notificará al administrador.
              </AlertDescription>
            </Alert>
          )}

          {/* Print Options */}
          <div className="bg-secondary/30 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Imprimir comprobante (con copia):</Label>
            </div>
            <RadioGroup value={ticketType} onValueChange={handleTicketTypeChange} className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="a4" id="credit_a4" />
                <Label htmlFor="credit_a4" className="text-sm cursor-pointer">A4</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tickeadora" id="credit_ticket" />
                <Label htmlFor="credit_ticket" className="text-sm cursor-pointer">Ticket</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_imprimir" id="credit_no" />
                <Label htmlFor="credit_no" className="text-sm cursor-pointer">No imprimir</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="show_debt"
                checked={showDebtOnPrint}
                onCheckedChange={(checked) => handleShowDebtChange(checked === true)}
              />
              <Label htmlFor="show_debt" className="text-sm cursor-pointer">
                Mostrar deuda total en comprobante
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="default"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-2 transition-all"
              disabled={processing}
              onClick={async () => {
                if (processing) return;
                setProcessing(true);
                await onFiar(ticketType, showDebtOnPrint);
              }}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-6 w-6" />
                <span className="font-semibold text-lg">💳 FIAR</span>
              </div>
              <span className="text-xs opacity-80">
                {canFiar 
                  ? "Venta a crédito directa (Atajo: 1)" 
                  : "Procesar y notificar admin (Atajo: 1)"}
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
                <span className="font-semibold text-lg">💰 PAGAR PARCIAL y hacer la venta</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Abonar primero, recalcular y fiar (Atajo: 2)
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-2 hover:bg-secondary hover:border-primary transition-all"
              onClick={onPayTotal}
              disabled={!hasDebt}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                <span className="font-semibold text-lg">🧾 PAGAR DEUDA TOTAL</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Saldar toda la deuda sin venta (Atajo: 3)
              </span>
            </Button>
          </div>

          <Button variant="ghost" onClick={onClose} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditOptionsModal;
