import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Expense, Supplier } from "./ExpensesTab";
import SupplierDialog from "./SupplierDialog";

interface ExpenseDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  expense: Expense | null;
  suppliers: Supplier[];
}

const ExpenseDialog = ({ open, onClose, expense, suppliers }: ExpenseDialogProps) => {
  const { user } = useAuth();
  const empresaId = useEmpresaId();
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");

  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    if (expense) {
      setSupplierId(expense.supplier_id);
      setAmount(String(expense.amount));
      setPaymentMethod(expense.payment_method);
      setPaymentStatus(expense.payment_status);
      setInvoiceNumber(expense.invoice_number || "");
      setExpenseDate(new Date(expense.expense_date));
      setNotes(expense.notes || "");
      setReceiptUrl(expense.receipt_url || "");
      setReceiptPreview(expense.receipt_url || "");
    } else {
      resetForm();
    }
  }, [expense, open]);

  const resetForm = () => {
    setSupplierId("");
    setAmount("");
    setPaymentMethod("cash");
    setPaymentStatus("pending");
    setInvoiceNumber("");
    setExpenseDate(new Date());
    setNotes("");
    setReceiptUrl("");
    setReceiptFile(null);
    setReceiptPreview("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no soportado. Use PNG, JPG, WEBP o PDF");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo no debe superar 5MB");
      return;
    }

    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview("");
    }
  };

  const removeFile = () => {
    setReceiptFile(null);
    setReceiptPreview("");
    if (!expense?.receipt_url) {
      setReceiptUrl("");
    }
  };

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return receiptUrl || null;

    setUploadingFile(true);
    const fileExt = receiptFile.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("expense-receipts")
      .upload(fileName, receiptFile);

    setUploadingFile(false);

    if (error) {
      console.error("Error uploading receipt:", error);
      toast.error("Error al subir el comprobante");
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("expense-receipts")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error("Seleccione un proveedor");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }

    setLoading(true);

    // Upload receipt if new file
    let finalReceiptUrl = receiptUrl;
    if (receiptFile) {
      const uploadedUrl = await uploadReceipt();
      if (uploadedUrl) {
        finalReceiptUrl = uploadedUrl;
        
        // Delete old receipt if replacing
        if (expense?.receipt_url && expense.receipt_url !== finalReceiptUrl) {
          const oldPath = expense.receipt_url.split("/expense-receipts/")[1];
          if (oldPath) {
            await supabase.storage.from("expense-receipts").remove([oldPath]);
          }
        }
      }
    }

    const expenseData = {
      empresa_id: empresaId,
      supplier_id: supplierId,
      amount: Number(amount),
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      invoice_number: invoiceNumber || null,
      expense_date: expenseDate.toISOString(),
      notes: notes || null,
      receipt_url: finalReceiptUrl || null,
    };

    if (expense) {
      // Update
      const { error } = await supabase
        .from("expenses")
        .update(expenseData)
        .eq("id", expense.id);

      if (error) {
        console.error("Error updating expense:", error);
        toast.error("Error al actualizar el gasto");
        setLoading(false);
        return;
      }
      toast.success("Gasto actualizado");
    } else {
      // Create
      const { error } = await supabase
        .from("expenses")
        .insert({
          ...expenseData,
          created_by: user?.id,
        });

      if (error) {
        console.error("Error creating expense:", error);
        toast.error("Error al crear el gasto");
        setLoading(false);
        return;
      }
      toast.success("Gasto registrado");

      // Si es efectivo y pagado, vincular con caja abierta
      if (paymentMethod === "cash" && paymentStatus === "paid" && user?.id) {
        const { data: openRegister } = await supabase
          .from("cash_register")
          .select("id")
          .eq("cashier_id", user.id)
          .eq("status", "open")
          .maybeSingle();

        if (openRegister) {
          const supplierName = localSuppliers.find(s => s.id === supplierId)?.name || "Proveedor";
          await supabase.from("cash_register_expenses").insert({
            cash_register_id: openRegister.id,
            amount: Number(amount),
            description: `Gasto proveedor: ${supplierName}${notes ? ` - ${notes}` : ""}`,
            category: "operational",
            created_by: user.id,
          });
        }
      }
    }

    setLoading(false);
    onClose(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier */}
          <div className="space-y-2">
            <Label>Proveedor *</Label>
            <Select value={supplierId} onValueChange={(value) => {
              if (value === "__new__") {
                setShowSupplierDialog(true);
              } else {
                setSupplierId(value);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {localSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.tax_id && `(${s.tax_id})`}
                  </SelectItem>
                ))}
                <SelectItem value="__new__" className="text-primary font-semibold">
                  + Agregar nuevo proveedor
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Monto *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Payment Method & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado de Pago *</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice Number & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº Factura/Comprobante</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha del Gasto *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expenseDate ? format(expenseDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows={3}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Comprobante</Label>
            {receiptPreview || (receiptUrl && !receiptFile) ? (
              <div className="relative border rounded-lg p-2">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Comprobante"
                    className="max-h-40 mx-auto rounded"
                  />
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Comprobante cargado (PDF)
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click para subir imagen o PDF
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP, PDF (máx 5MB)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingFile}>
              {(loading || uploadingFile) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {expense ? "Guardar Cambios" : "Registrar Gasto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <SupplierDialog
      open={showSupplierDialog}
      onClose={async (refresh) => {
        setShowSupplierDialog(false);
        if (refresh) {
          let query = supabase
            .from("suppliers")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);
          if (empresaId) query = query.eq("empresa_id", empresaId);
          const { data } = await query.single();
          if (data) {
            setLocalSuppliers((prev) => [...prev, data as Supplier]);
            setSupplierId(data.id);
          }
        }
      }}
      supplier={null}
      empresaId={empresaId}
    />
    </>
  );
};

export default ExpenseDialog;
