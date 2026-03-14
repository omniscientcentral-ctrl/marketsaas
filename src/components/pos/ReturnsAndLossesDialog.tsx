import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PackageMinus, AlertTriangle } from "lucide-react";
import SupervisorPinDialog from "./SupervisorPinDialog";
import ProductSearchAutocomplete from "./ProductSearchAutocomplete";
import CustomerSelectDialog from "./CustomerSelectDialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";

// Mapeo de valores frontend → valores permitidos en la base de datos
const RETURN_TYPE_MAP = {
  merma: "loss",
  devolucion: "return",
} as const;

const REFUND_METHOD_MAP = {
  sin_reintegro: "none",
  efectivo: "cash",
  tarjeta: "card",
  credito_cliente: "credit",
} as const;

const MOVEMENT_TYPE_MAP = {
  merma: "loss",
  devolucion: "return",
} as const;

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  stock: number;
  min_stock: number;
  stock_disabled?: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  credit_limit: number;
  current_balance: number;
}

interface ReturnsAndLossesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisterSessionId?: string;
}

export function ReturnsAndLossesDialog({ open, onOpenChange, cashRegisterSessionId }: ReturnsAndLossesDialogProps) {
  const empresaId = useEmpresaId();
  const [returnType, setReturnType] = useState<"merma" | "devolucion">("merma");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<string>("1");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [refundMethod, setRefundMethod] = useState<string>("sin_reintegro");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [relatedSaleId, setRelatedSaleId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<any>(null);

  // Resetear formulario al cerrar
  useEffect(() => {
    if (!open) {
      setReturnType("merma");
      setSelectedProduct(null);
      setQuantity("1");
      setReason("");
      setNotes("");
      setRefundMethod("sin_reintegro");
      setRefundAmount("");
      setRelatedSaleId("");
      setSelectedCustomer(null);
    }
  }, [open]);

  // Auto-calcular monto de reintegro basado en producto y cantidad
  useEffect(() => {
    if (selectedProduct && quantity && returnType === "devolucion" && refundMethod !== "sin_reintegro") {
      const calculatedAmount = selectedProduct.price * parseFloat(quantity || "0");
      setRefundAmount(calculatedAmount.toFixed(2));
    }
  }, [selectedProduct, quantity, returnType, refundMethod]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast.error("Selecciona un producto");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Cantidad inválida");
      return;
    }

    if (!reason.trim()) {
      toast.error("Ingresa un motivo");
      return;
    }

    // Si es devolución con reintegro de dinero, requiere supervisor
    if (returnType === "devolucion" && refundMethod !== "sin_reintegro" && refundMethod !== "credito_cliente") {
      setPendingOperation({
        product: selectedProduct,
        quantity: qty,
        reason,
        notes,
        refundMethod,
        refundAmount: parseFloat(refundAmount || "0"),
      });
      setShowSupervisorPin(true);
      return;
    }

    // Procesar directamente si no requiere supervisor
    await processReturn(null);
  };

  const handleSupervisorAuth = async (supervisorName?: string) => {
    setShowSupervisorPin(false);
    // Buscar el ID del supervisor por nombre
    if (supervisorName) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("full_name", supervisorName)
        .maybeSingle();
      
      await processReturn(data?.id || null);
    } else {
      await processReturn(null);
    }
  };

  const processReturn = async (supervisorId: string | null) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const qty = parseInt(quantity);
      const refundAmt = parseFloat(refundAmount || "0");

      // 1. Crear registro en tabla returns
      const { data: returnRecord, error: returnError } = await supabase
        .from("returns")
        .insert({
          product_id: selectedProduct!.id,
          product_name: selectedProduct!.name,
          quantity: qty,
          return_type: RETURN_TYPE_MAP[returnType],
          reason,
          notes: notes || null,
          refund_amount: returnType === "devolucion" ? refundAmt : 0,
          refund_method: returnType === "devolucion" 
            ? (REFUND_METHOD_MAP[refundMethod as keyof typeof REFUND_METHOD_MAP] ?? "none")
            : "none",
          customer_id: selectedCustomer?.id || null,
          related_sale_id: relatedSaleId || null,
          performed_by: user.id,
          authorized_by: supervisorId,
          cash_register_session_id: cashRegisterSessionId || null,
          empresa_id: empresaId,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // 2. Obtener stock actual desde product_stock_balance (fuente de verdad)
      const { data: balanceData, error: balanceFetchError } = await supabase
        .from("product_stock_balance")
        .select("current_balance")
        .eq("product_id", selectedProduct!.id)
        .maybeSingle();

      if (balanceFetchError) throw balanceFetchError;

      const previousStock = balanceData?.current_balance ?? 0;

      // Determinar si el stock se suma o resta basado en el tipo y motivo
      // Mermas con ciertos motivos devuelven el producto al stock
      const motivosQueDevuelvenStock = ["cambio_opinion", "error_cobro"];
      const sumaAlStock = returnType === "devolucion" || 
        (returnType === "merma" && motivosQueDevuelvenStock.includes(reason));

      const stockChange = sumaAlStock ? qty : -qty;
      const newStock = previousStock + stockChange;

      // El stock se actualiza automáticamente en product_stock_balance
      // mediante el trigger update_stock_balance cuando se inserta el stock_movement

      // 4. Crear movimiento de stock con valores mapeados
      const movementType = MOVEMENT_TYPE_MAP[returnType];

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: selectedProduct!.id,
          movement_type: movementType,
          quantity: stockChange,
          previous_stock: previousStock,
          new_stock: newStock,
          reference_id: returnRecord.id,
          notes: `${returnType === "merma" ? "Merma" : "Devolución"}: ${reason}`,
          performed_by: user.id,
          reason: RETURN_TYPE_MAP[returnType],
          empresa_id: empresaId,
        });

      if (movementError) throw movementError;

      // 3. Si es devolución con crédito al cliente, actualizar su saldo
      if (returnType === "devolucion" && refundMethod === "credito_cliente" && selectedCustomer) {
        // Obtener saldo ACTUAL del cliente (no el cached del estado)
        const { data: currentCustomer, error: fetchError } = await supabase
          .from("customers")
          .select("current_balance")
          .eq("id", selectedCustomer.id)
          .single();

        if (fetchError) throw fetchError;

        const newBalance = Number(currentCustomer.current_balance) - refundAmt;

        const { error: customerError } = await supabase
          .from("customers")
          .update({ current_balance: newBalance })
          .eq("id", selectedCustomer.id);

        if (customerError) throw customerError;
      }

      // 4. Si es devolución con dinero efectivo/tarjeta, registrar egreso en caja
      if (returnType === "devolucion" && (refundMethod === "efectivo" || refundMethod === "tarjeta") && cashRegisterSessionId) {
        const { error: expenseError } = await supabase
          .from("cash_register_expenses")
          .insert({
            cash_register_id: cashRegisterSessionId,
            description: `Devolución: ${selectedProduct!.name} (${qty} unidades)`,
            amount: refundAmt,
            category: "devolucion",
            created_by: user.id,
            empresa_id: empresaId,
          });

        if (expenseError) console.error("Error registrando egreso:", expenseError);
      }

      toast.success(
        returnType === "merma" 
          ? `Merma registrada: ${qty} unidad(es) de ${selectedProduct!.name}`
          : `Devolución procesada: ${qty} unidad(es) de ${selectedProduct!.name}${refundAmt > 0 ? ` - Reintegro: $${refundAmt.toFixed(2)}` : ""}`
      );

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error procesando operación:", error);
      toast.error(error.message || "Error al procesar la operación");
    } finally {
      setLoading(false);
      setPendingOperation(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5 text-destructive" />
              <DialogTitle>Registrar Merma / Devolución</DialogTitle>
            </div>
            <DialogDescription>
              Registra productos devueltos por clientes o mermas internas (defectos, vencimientos, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Tipo de registro */}
            <div className="space-y-2">
              <Label>Tipo de Registro</Label>
              <RadioGroup value={returnType} onValueChange={(v) => setReturnType(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="merma" id="merma" />
                  <Label htmlFor="merma" className="font-normal cursor-pointer">
                    Merma Interna (sin reintegro al cliente)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="devolucion" id="devolucion" />
                  <Label htmlFor="devolucion" className="font-normal cursor-pointer">
                    Devolución de Cliente (con posible reintegro)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Buscar producto */}
            <div className="space-y-2">
              <Label>Producto *</Label>
              <ProductSearchAutocomplete onSelect={handleProductSelect} />
              {selectedProduct && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="font-medium">{selectedProduct.name}</p>
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Precio: ${selectedProduct.price.toFixed(2)}</p>
                    <p>Stock actual: {selectedProduct.stock} unidades</p>
                    {selectedProduct.stock_disabled && (
                      <div className="flex items-center gap-1 text-warning mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Stock desactivado para este producto</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Unidades afectadas"
              />
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defecto">Producto defectuoso</SelectItem>
                  <SelectItem value="vencido">Producto vencido</SelectItem>
                  <SelectItem value="cambio_opinion">Cambio de opinión del cliente</SelectItem>
                  <SelectItem value="error_cobro">Error en el cobro</SelectItem>
                  <SelectItem value="rotura">Rotura o daño</SelectItem>
                  <SelectItem value="otro">Otro motivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas adicionales */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={3}
              />
            </div>

            {/* Opciones de devolución */}
            {returnType === "devolucion" && (
              <>
                <div className="space-y-2">
                  <Label>Método de Reintegro</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_reintegro">Sin reintegro</SelectItem>
                      <SelectItem value="efectivo">Devolver en efectivo</SelectItem>
                      <SelectItem value="tarjeta">Devolver a tarjeta</SelectItem>
                      <SelectItem value="credito_cliente">Dejar como crédito a favor del cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {refundMethod !== "sin_reintegro" && (
                  <div className="space-y-2">
                    <Label htmlFor="refundAmount">Monto a Reintegrar</Label>
                    <Input
                      id="refundAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}

                {refundMethod === "credito_cliente" && (
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCustomerSelect(true)}
                        className="flex-1"
                      >
                        {selectedCustomer ? selectedCustomer.name : "Seleccionar cliente"}
                      </Button>
                      {selectedCustomer && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedCustomer(null)}
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="relatedSaleId">ID de Venta Relacionada (opcional)</Label>
                  <Input
                    id="relatedSaleId"
                    value={relatedSaleId}
                    onChange={(e) => setRelatedSaleId(e.target.value)}
                    placeholder="UUID de la venta original"
                  />
                </div>
              </>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !selectedProduct || !reason}
                className="flex-1"
              >
                {loading ? "Procesando..." : returnType === "merma" ? "Registrar Merma" : "Procesar Devolución"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CustomerSelectDialog
        open={showCustomerSelect}
        onClose={() => setShowCustomerSelect(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerSelect(false);
        }}
        onClear={() => setSelectedCustomer(null)}
      />

      <SupervisorPinDialog
        open={showSupervisorPin}
        onOpenChange={setShowSupervisorPin}
        onSuccess={handleSupervisorAuth}
        title="Autorización de Supervisor"
        description="Se requiere autorización de supervisor para procesar devoluciones con reintegro de dinero."
      />
    </>
  );
}
