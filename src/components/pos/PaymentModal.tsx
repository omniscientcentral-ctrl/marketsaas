import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign, CreditCard, Split } from "lucide-react";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onComplete: (
    paymentMethod: string,
    ticketType: string,
    cashAmount?: number,
    cardAmount?: number,
    receivedAmount?: number
  ) => void;
}

const PaymentModal = ({ open, onClose, total, onComplete }: PaymentModalProps) => {
  const [receivedAmount, setReceivedAmount] = useState(total);
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [ticketType, setTicketType] = useState(() => {
    return localStorage.getItem("pos_ticket_type") || "tickeadora";
  });

  const [transferReference, setTransferReference] = useState('');
  const [transferReferenceValid, setTransferReferenceValid] = useState(false);

  const handleTicketTypeChange = (value: string) => {
    setTicketType(value);
    localStorage.setItem("pos_ticket_type", value);
  };

  const handleClose = () => {
    setReceivedAmount(total);
    setCashAmount(0);
    setCardAmount(0);
    setTransferReference('');
    setTransferReferenceValid(false);
    setProcessing(false);
    onClose();
  };

  const handleTransferPayment = () => {
    if (processing) return;
    if (!transferReference.trim()) {
      alert('Ingrese la referencia de la transferencia');
      return;
    }
    setProcessing(true);
    onComplete('transfer', ticketType, undefined, undefined, total);
    handleClose();
  };

  const handleCashPayment = () => {
    if (processing) return;
    if (receivedAmount < total) {
      alert("El monto recibido debe ser mayor o igual al total");
      return;
    }
    setProcessing(true);
    onComplete("cash", ticketType, total, undefined, receivedAmount);
    handleClose();
  };

  const handleCardPayment = () => {
    if (processing) return;
    setProcessing(true);
    onComplete("card", ticketType, undefined, total);
    handleClose();
  };

  const handleMixedPayment = () => {
    if (processing) return;
    if (cashAmount + cardAmount !== total) {
      alert("La suma de efectivo y tarjeta debe ser igual al total");
      return;
    }
    setProcessing(true);
    onComplete("mixed", ticketType, cashAmount, cardAmount);
    handleClose();
  };

  const changeAmount = receivedAmount - total;
  const remainingMixed = total - (cashAmount + cardAmount);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrar - Total: ${total.toFixed(2)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4 border-b">
          <Label className="text-sm font-medium">Tipo de Ticket</Label>
          <RadioGroup value={ticketType} onValueChange={handleTicketTypeChange} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="a4" id="a4" />
              <Label htmlFor="a4" className="font-normal cursor-pointer">A4</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="tickeadora" id="tickeadora" />
              <Label htmlFor="tickeadora" className="font-normal cursor-pointer">Tickeadora</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no_imprimir" id="no_imprimir" />
              <Label htmlFor="no_imprimir" className="font-normal cursor-pointer">No imprimir</Label>
            </div>
          </RadioGroup>
        </div>

        <Tabs defaultValue="cash" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cash">
              <DollarSign className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="card">
              <CreditCard className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="mixed">
              <Split className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <DollarSign className="h-4 w-4" /> {/* Using same icon for now, can change */}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="space-y-4">
            <div>
              <Label htmlFor="received">Monto Recibido</Label>
              <Input
                id="received"
                type="number"
                step="0.01"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                className="text-lg h-12"
                autoFocus
              />
            </div>

            {changeAmount >= 0 && (
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground">Cambio</p>
                <p className="text-2xl font-bold text-primary">
                  ${changeAmount.toFixed(2)}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setReceivedAmount(total)}
                className="flex-1"
              >
                Exacto
              </Button>
              <Button
                variant="outline"
                onClick={() => setReceivedAmount(Math.ceil(total / 100) * 100)}
                className="flex-1"
              >
                Redondear
              </Button>
            </div>

            <Button onClick={handleCashPayment} className="w-full h-12" size="lg" disabled={processing}>
              <DollarSign className="mr-2 h-5 w-5" />
              Cobrar Efectivo
            </Button>
          </TabsContent>

          <TabsContent value="card" className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Total a Cobrar</p>
              <p className="text-3xl font-bold text-primary">${total.toFixed(2)}</p>
            </div>

            <Button onClick={handleCardPayment} className="w-full h-12" size="lg" disabled={processing}>
              <CreditCard className="mr-2 h-5 w-5" />
              Cobrar con Tarjeta
            </Button>
          </TabsContent>

          <TabsContent value="mixed" className="space-y-4">
            <div>
              <Label htmlFor="cash-mixed">Efectivo</Label>
              <Input
                id="cash-mixed"
                type="number"
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                className="h-12"
              />
            </div>

            <div>
              <Label htmlFor="card-mixed">Tarjeta</Label>
              <Input
                id="card-mixed"
                type="number"
                step="0.01"
                value={cardAmount}
                onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                className="h-12"
              />
            </div>

            <div className="p-4 bg-secondary rounded-lg">
              <div className="flex justify-between text-sm mb-1">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Pagado:</span>
                <span>${(cashAmount + cardAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Falta:</span>
                <span className={remainingMixed > 0 ? "text-destructive" : "text-success"}>
                  ${Math.abs(remainingMixed).toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleMixedPayment}
              className="w-full h-12"
              size="lg"
              disabled={remainingMixed !== 0 || processing}
            >
              <Split className="mr-2 h-5 w-5" />
              Cobrar Mixto
            </Button>
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Total a Transferir</p>
              <p className="text-3xl font-bold text-primary">${total.toFixed(2)}</p>
            </div>

            <div>
              <Label htmlFor="transfer-reference">Referencia de Transferencia</Label>
              <Input
                id="transfer-reference"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                className="h-12"
                placeholder="Número de referencia o autorización"
              />
            </div>

            <Button
              onClick={handleTransferPayment}
              className="w-full h-12"
              size="lg"
              disabled={processing || !transferReference.trim()}
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Confirmar Transferencia
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Una vez confirmada la transferencia, el sistema registrará el pago.
              Guarde el comprobante para sus registros.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
