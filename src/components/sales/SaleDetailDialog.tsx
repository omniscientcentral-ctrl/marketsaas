import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Receipt, Loader2, RefreshCw, Ban } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateSaleA4PDF, generateSaleTicketPDF, generateSaleDualA4PDF } from "@/lib/pdfSaleGenerator";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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

interface SaleDetailDialogProps {
  saleId: string | null;
  open: boolean;
  onClose: () => void;
}

export function SaleDetailDialog({ saleId, open, onClose }: SaleDetailDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDebt, setShowDebt] = useState(true);
  const { activeRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: saleDetail, isLoading } = useQuery({
    queryKey: ["sale-detail", saleId],
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!saleId) return null;

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, sale_number, created_at, status, cashier_id, customer_id, customer_name, cash_register_session_id, replaces_sale_id, payment_method, cash_amount, card_amount, credit_amount, total, notes")
        .eq("id", saleId)
        .single();

      if (saleError) throw saleError;

      let cashierData = null;
      if (sale.cashier_id) {
        const { data: cashier } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", sale.cashier_id)
          .single();
        cashierData = cashier;
      }

      let customerData = null;
      if (sale.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, document, rut, phone, current_balance, credit_limit, notes")
          .eq("id", sale.customer_id)
          .single();
        customerData = customer;
      }

      let cashRegisterData = null;
      let sessionId = null;
      if (sale.cash_register_session_id) {
        sessionId = sale.cash_register_session_id;
        const { data: session } = await supabase
          .from("cash_register_sessions")
          .select(`id, cash_register_id, cash_registers(name, location)`)
          .eq("id", sale.cash_register_session_id)
          .single();
        if (session) {
          cashRegisterData = {
            name: (session as any).cash_registers?.name || "N/A",
            location: (session as any).cash_registers?.location || null,
          };
        }
      }

      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("id, product_id, product_name, quantity, unit_price, subtotal")
        .eq("sale_id", saleId);
      if (itemsError) throw itemsError;

      const { data: company } = await supabase
        .from("company_settings")
        .select("company_name, tax_id, address, city, phone, email, currency, receipt_footer, logo_url")
        .limit(1)
        .single();

      let replacedSaleNumber: number | null = null;
      if (sale.replaces_sale_id) {
        const { data: replacedSale } = await supabase
          .from("sales")
          .select("sale_number")
          .eq("id", sale.replaces_sale_id)
          .single();
        replacedSaleNumber = replacedSale?.sale_number || null;
      }

      let replacedBySaleNumber: number | null = null;
      let replacedBySaleId: string | null = null;
      const { data: replacementSale } = await supabase
        .from("sales")
        .select("id, sale_number")
        .eq("replaces_sale_id", saleId)
        .maybeSingle();
      if (replacementSale) {
        replacedBySaleNumber = replacementSale.sale_number;
        replacedBySaleId = replacementSale.id;
      }

      return {
        sale: {
          ...sale,
          cashier: cashierData,
          customer: customerData,
          cash_register: cashRegisterData,
          session_id: sessionId,
          replacedSaleNumber,
          replacedBySaleNumber,
          replacedBySaleId,
        },
        items,
        company,
      };
    },
    enabled: !!saleId && open,
  });

  const handleCancelSale = async () => {
    if (!saleDetail || !saleId) return;
    const sale = saleDetail.sale;
    const items = saleDetail.items;

    setIsCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // 1. Revert stock for each item
      for (const item of items) {
        if (!item.product_id) continue;

        const { data: product } = await supabase
          .from("products")
          .select("stock, stock_disabled")
          .eq("id", item.product_id)
          .single();

        if (product && !product.stock_disabled) {
          const previousStock = product.stock;
          const newStock = previousStock + item.quantity;

          // Check if product has active batches
          const { data: activeBatch } = await supabase
            .from("product_batches")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeBatch) {
            // Update batch quantity; trigger will auto-sync products.stock
            await supabase
              .from("product_batches")
              .update({ quantity: activeBatch.quantity + item.quantity })
              .eq("id", activeBatch.id);
          } else {
            // No batches: update products.stock directly
            await supabase
              .from("products")
              .update({ stock: newStock })
              .eq("id", item.product_id);
          }

          await supabase.from("stock_movements").insert({
            product_id: item.product_id,
            movement_type: "sale_cancel_return",
            quantity: item.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: saleId,
            performed_by: user.id,
            notes: `Devolución por anulación de venta #${sale.sale_number}`,
          });
        }
      }

      // 2. Revert credit if applicable
      if ((sale.credit_amount ?? 0) > 0 && sale.customer_id) {
        // Cancel credits linked to this sale
        const { data: credits } = await supabase
          .from("credits")
          .select("id, balance, status")
          .eq("sale_id", saleId);

        if (credits && credits.length > 0) {
          for (const credit of credits) {
            if (credit.status !== "cancelled") {
              await supabase
                .from("credits")
                .update({ status: "cancelled", balance: 0 })
                .eq("id", credit.id);
            }
          }
        }

        // Recalculate current_balance from actual pending credits
        const { data: activeCredits } = await supabase
          .from("credits")
          .select("balance")
          .eq("customer_id", sale.customer_id)
          .in("status", ["pending", "partial"]);

        const recalculatedBalance = (activeCredits || []).reduce(
          (sum: number, c: any) => sum + (c.balance ?? 0), 0
        );

        await supabase
          .from("customers")
          .update({ current_balance: recalculatedBalance })
          .eq("id", sale.customer_id);
      }

      // 3. Mark sale as cancelled
      await supabase
        .from("sales")
        .update({ status: "cancelled", notes: "Anulada manualmente" })
        .eq("id", saleId);

      // 4. Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["sale-detail", saleId] });
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });

      toast.success(`Venta #${sale.sale_number} anulada correctamente`);
      setShowCancelConfirm(false);
    } catch (error) {
      console.error("Error anulando venta:", error);
      toast.error("Error al anular la venta");
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrintA4 = async () => {
    if (!saleDetail) return;
    setIsGenerating(true);
    try {
      const saleWithReplace = { ...saleDetail.sale, replaces_sale_number: saleDetail.sale.replacedSaleNumber || undefined };
      const isCredit = saleWithReplace.payment_method === "credit" || 
        (saleWithReplace.payment_method === "mixed" && (saleWithReplace.credit_amount ?? 0) > 0);
      
      if (isCredit) {
        await generateSaleDualA4PDF(saleWithReplace, saleDetail.items, saleDetail.company, showDebt);
      } else {
        await generateSaleA4PDF(saleWithReplace, saleDetail.items, saleDetail.company, undefined, showDebt);
      }
      toast.success("Comprobante A4 generado");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("sale_print_audit").insert({
          sale_id: saleId, print_type: "A4", printed_by: user.id,
        });
      }
    } catch (error) {
      console.error("Error generando PDF:", error);
      toast.error("Error al generar el comprobante");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintTicket = async () => {
    if (!saleDetail) return;
    setIsGenerating(true);
    try {
      const saleWithReplace = { ...saleDetail.sale, replaces_sale_number: saleDetail.sale.replacedSaleNumber || undefined };
      await generateSaleTicketPDF(saleWithReplace, saleDetail.items, saleDetail.company, undefined, showDebt);
      toast.success("Ticket generado");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("sale_print_audit").insert({
          sale_id: saleId, print_type: "ticket", printed_by: user.id,
        });
      }
    } catch (error) {
      console.error("Error generando ticket:", error);
      toast.error("Error al generar el ticket");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRedoSale = () => {
    if (!saleDetail || !saleId) return;
    const redoData = {
      originalSaleId: saleId,
      originalSaleNumber: saleDetail.sale.sale_number,
      customerId: saleDetail.sale.customer_id || null,
      customerName: saleDetail.sale.customer_name || null,
      items: saleDetail.items.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    };
    sessionStorage.setItem("pos_redo_sale", JSON.stringify(redoData));
    onClose();
    navigate("/pos");
    toast.info(`Cargando productos de venta #${saleDetail.sale.sale_number} en el POS`);
  };

  if (!saleDetail && !isLoading) return null;

  const sale = saleDetail?.sale;
  const items = saleDetail?.items || [];
  const canRedo = sale?.status === "completed" && (activeRole === "admin" || activeRole === "supervisor");
  const canCancel = sale?.status === "completed" && (activeRole === "admin" || activeRole === "supervisor");

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle>Detalle de Venta #{sale?.sale_number}</DialogTitle>
            <div className="flex gap-2">
              {canCancel && (
                <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(true)} disabled={isCancelling}>
                  {isCancelling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}
                  Anular venta
                </Button>
              )}
              {canRedo && (
                <Button variant="outline" size="sm" onClick={handleRedoSale}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Rehacer venta
                </Button>
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sale ? (
            <div className="space-y-6">
              {sale.replacedSaleNumber && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm font-semibold text-primary">
                    ⟳ Esta venta reemplaza a la Venta #{sale.replacedSaleNumber} (anulada)
                  </p>
                </div>
              )}
              {sale.replacedBySaleNumber && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm font-semibold text-destructive">
                    ✕ Esta venta fue anulada y reemplazada por la Venta #{sale.replacedBySaleNumber}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fecha y Hora</p>
                  <p className="font-semibold">
                    {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={sale.status === "completed" ? "default" : "destructive"}>
                    {sale.status === "completed" ? "Completada" : sale.status === "cancelled" ? "Anulada" : sale.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cajero</p>
                  <p className="font-semibold">{sale.cashier?.full_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-semibold">{sale.customer?.name || sale.customer_name || "Mostrador"}</p>
                  {sale.customer?.document && (
                    <p className="text-sm text-muted-foreground">{sale.customer.document}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Items</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${item.subtotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Método de pago:</span>
                  <Badge>
                    {sale.payment_method === "cash" && "Efectivo"}
                    {sale.payment_method === "card" && "Tarjeta"}
                    {sale.payment_method === "credit" && "Crédito"}
                    {sale.payment_method === "mixed" && "Mixto"}
                    {sale.payment_method === "transfer" && "Transferencia"}
                  </Badge>
                </div>
                {sale.cash_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo:</span>
                    <span className="font-semibold">${sale.cash_amount.toFixed(2)}</span>
                  </div>
                )}
                {sale.card_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarjeta:</span>
                    <span className="font-semibold">${sale.card_amount.toFixed(2)}</span>
                  </div>
                )}
                {sale.credit_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Crédito:</span>
                    <span className="font-semibold">${sale.credit_amount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">Total:</span>
                  <span className="font-bold text-2xl">${sale.total.toFixed(2)}</span>
                </div>
              </div>

              {(sale.payment_method === "credit" || sale.payment_method === "mixed") && sale.credit_amount > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <Switch id="show-debt" checked={showDebt} onCheckedChange={setShowDebt} />
                  <Label htmlFor="show-debt" className="text-sm">Mostrar deuda en comprobante</Label>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handlePrintA4} disabled={isGenerating} className="flex-1">
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Reimprimir A4
                </Button>
                <Button onClick={handlePrintTicket} disabled={isGenerating} variant="outline" className="flex-1">
                  {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                  Reimprimir Ticket
                </Button>
              </div>

              {sale.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm">{sale.notes}</p>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta #{sale?.sale_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revertirá el stock de todos los productos vendidos.
              {(sale?.credit_amount ?? 0) > 0 && sale?.customer_id && (
                <> También se cancelará el crédito asociado y se reducirá el balance del cliente.</>
              )}
              {" "}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSale}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sí, anular venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
