import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, DollarSign, History } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateDebtPaymentTicket } from "@/lib/pdfDebtPaymentGenerator";

interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  credit_limit: number;
  current_balance: number;
  status: string;
}

interface CreditSale {
  id: string;
  sale_id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  sale_number?: number;
}

interface PaymentHistory {
  id: string;
  amount: number;
  payment_method: string;
  created_at: string;
  received_by: string;
}

interface DebtPaymentModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onPaymentComplete: (remainingBalance: number, mode: "partial" | "total") => void;
  mode?: "partial" | "total";
}

const DebtPaymentModal = ({ open, onClose, customer, onPaymentComplete, mode = "total" }: DebtPaymentModalProps) => {
  const [credits, setCredits] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(false);
  const isProcessingRef = useRef(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedCredits, setSelectedCredits] = useState<string[]>([]);
  const [applyMode, setApplyMode] = useState<"fifo" | "manual">("fifo");
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);

  useEffect(() => {
    if (open && customer) {
      fetchCustomerCredits();
      fetchPaymentHistory();
      // Pre-fill amount for total payment mode
      if (mode === "total") {
        setAmount(customer.current_balance.toString());
      } else {
        setAmount("");
      }
    }
  }, [open, customer, mode]);

  const fetchCustomerCredits = async () => {
    if (!customer) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("credits")
        .select(`
          *,
          sales:sale_id (
            sale_number
          )
        `)
        .eq("customer_id", customer.id)
        .in("status", ["pending", "partial"])
        .gt("balance", 0)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      const creditsWithSaleNumber = data.map(credit => ({
        ...credit,
        sale_number: (credit.sales as any)?.sale_number
      }));
      
      setCredits(creditsWithSaleNumber);
    } catch (error: any) {
      toast.error("Error al cargar créditos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    if (!customer) return;

    try {
      const { data, error } = await supabase
        .from("credit_payments")
        .select(`
          id,
          amount,
          payment_method,
          created_at,
          received_by,
          payment_group_id
        `)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by payment_group_id to consolidate FIFO splits
      const groupedMap = new Map<string, PaymentHistory>();
      for (const p of (data || [])) {
        const key = (p as any).payment_group_id || p.id;
        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)!;
          existing.amount += p.amount;
        } else {
          groupedMap.set(key, { ...p });
        }
      }
      setPaymentHistory(Array.from(groupedMap.values()).slice(0, 10));
    } catch (error: any) {
      toast.error("Error al cargar historial: " + error.message);
    }
  };

  const handlePayment = async () => {
    if (isProcessingRef.current) return;
    if (!customer || !amount || parseFloat(amount) <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }

    isProcessingRef.current = true;

    const paymentAmount = parseFloat(amount);

    setLoading(true);
    try {
      // Fetch fresh balance from DB to avoid stale data on receipt
      const { data: freshCustomer } = await supabase
        .from("customers")
        .select("current_balance")
        .eq("id", customer.id)
        .single();

      const freshBalance = freshCustomer?.current_balance ?? customer.current_balance;

      if (paymentAmount > freshBalance) {
        const confirm = window.confirm(
          `El monto (${paymentAmount.toFixed(2)}) excede la deuda (${freshBalance.toFixed(2)}). ¿Desea continuar?`
        );
        if (!confirm) {
          setLoading(false);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      let remainingAmount = paymentAmount;
      const paymentGroupId = crypto.randomUUID();
      const creditsToApply = applyMode === "fifo" 
        ? credits 
        : credits.filter(c => selectedCredits.includes(c.id));

      // Apply payments to credits
      for (const credit of creditsToApply) {
        if (remainingAmount <= 0) break;

        const amountToApply = Math.min(remainingAmount, credit.balance);
        const newPaidAmount = credit.paid_amount + amountToApply;
        const newBalance = credit.balance - amountToApply;

        // Create payment record
        const { error: paymentError } = await supabase
          .from("credit_payments")
          .insert({
            credit_id: credit.id,
            customer_id: customer.id,
            amount: amountToApply,
            payment_method: paymentMethod,
            received_by: user.id,
            payment_group_id: paymentGroupId,
          } as any);

        if (paymentError) throw paymentError;

        // Update credit
        const { error: creditError } = await supabase
          .from("credits")
          .update({
            paid_amount: newPaidAmount,
            balance: newBalance,
            status: newBalance === 0 ? "paid" : "partial",
          })
          .eq("id", credit.id);

        if (creditError) throw creditError;

        remainingAmount -= amountToApply;
      }

      // El balance del cliente se actualiza automáticamente mediante trigger
      // Obtener el nuevo balance calculado
      const { data: updatedCustomer, error: fetchError } = await supabase
        .from("customers")
        .select("current_balance")
        .eq("id", customer.id)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = updatedCustomer?.current_balance || 0;

      // Generate and print debt payment receipt
      try {
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("company_name, tax_id, address, city, phone, email, currency, receipt_footer, logo_url")
          .limit(1)
          .single();

        await generateDebtPaymentTicket({
          customerName: `${customer.name} ${customer.last_name || ""}`.trim(),
          paymentAmount,
          paymentMethod,
          previousBalance: freshBalance,
          newBalance,
          creditLimit: customer.credit_limit,
          company: companyData || undefined,
        });
      } catch (printError) {
        console.error("Error printing debt payment receipt:", printError);
      }

      toast.success(
        `Pago registrado: $${paymentAmount.toFixed(2)}. Nueva deuda: $${newBalance.toFixed(2)}`
      );
      
      onPaymentComplete(newBalance, mode);
      onClose();
    } catch (error: any) {
      toast.error("Error al procesar pago: " + error.message);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const toggleCreditSelection = (creditId: string) => {
    setSelectedCredits(prev =>
      prev.includes(creditId)
        ? prev.filter(id => id !== creditId)
        : [...prev, creditId]
    );
  };

  if (!customer) return null;

  const available = customer.credit_limit - customer.current_balance;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { isProcessingRef.current = false; onClose(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {mode === "partial" ? "💰 Pago Parcial" : "🧾 Gestionar Deuda"} - {customer.name} {customer.last_name || ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Historial de Pagos */}
          {showHistory && (
            <div className="border rounded-lg p-4 bg-secondary/30">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial de Pagos Recientes
              </h3>
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay pagos registrados
                </p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {paymentHistory.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-2 bg-background rounded border"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            ${payment.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.created_at), "dd/MMM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {payment.payment_method === "cash"
                            ? "Efectivo"
                            : payment.payment_method === "card"
                            ? "Tarjeta"
                            : "Transferencia"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Customer Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-secondary/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Deuda Actual</p>
              <p className="text-xl font-bold text-warning">
                ${customer.current_balance.toFixed(2)}
              </p>
            </div>
            <div className="bg-secondary/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Límite</p>
              <p className="text-xl font-bold">${customer.credit_limit.toFixed(2)}</p>
            </div>
            <div className="bg-secondary/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Disponible</p>
              <p className={`text-xl font-bold ${available < 0 ? "text-destructive" : "text-success"}`}>
                ${available.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Credits List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Ventas a Crédito Pendientes</h3>
              <Tabs value={applyMode} onValueChange={(v) => setApplyMode(v as any)}>
                <TabsList>
                  <TabsTrigger value="fifo">FIFO</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : credits.length === 0 ? (
              <div className="text-center py-8 bg-secondary/50 rounded-lg">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success opacity-50" />
                <p className="text-muted-foreground">No hay deudas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {credits.map((credit) => (
                  <div
                    key={credit.id}
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors ${
                      applyMode === "manual" && selectedCredits.includes(credit.id)
                        ? "border-primary bg-primary/10"
                        : ""
                    }`}
                    onClick={() => applyMode === "manual" && toggleCreditSelection(credit.id)}
                    style={{ cursor: applyMode === "manual" ? "pointer" : "default" }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Venta #{credit.sale_number || "N/A"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(credit.created_at), "dd/MMM/yyyy", { locale: es })}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total: ${credit.total_amount.toFixed(2)} | Pagado: ${credit.paid_amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-warning">${credit.balance.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Pendiente</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Form */}
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto a Pagar</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={customer.current_balance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setAmount(customer.current_balance.toString())}
                >
                  Pagar todo (${customer.current_balance.toFixed(2)})
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="cash">Efectivo</TabsTrigger>
                    <TabsTrigger value="card">Tarjeta</TabsTrigger>
                    <TabsTrigger value="transfer">Transfer.</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {parseFloat(amount) > customer.current_balance && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning rounded-lg">
                <AlertCircle className="h-5 w-5 text-warning" />
                <p className="text-sm">
                  El monto excede la deuda. El excedente quedará como saldo a favor.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handlePayment} 
              className="flex-1"
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DebtPaymentModal;
