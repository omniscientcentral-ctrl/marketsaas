import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, ShoppingCart } from "lucide-react";

interface CashExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisterId: string | null;
  userId: string | undefined;
}

const CashExpenseDialog = ({ open, onOpenChange, cashRegisterId, userId }: CashExpenseDialogProps) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("withdrawal");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (!description.trim()) {
      toast.error("Ingresá una descripción");
      return;
    }
    if (!cashRegisterId) {
      toast.error("No hay caja activa");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("cash_register_expenses").insert({
        cash_register_id: cashRegisterId,
        amount: parsedAmount,
        description: description.trim(),
        category,
        created_by: userId,
      });
      if (error) throw error;

      toast.success(`Gasto de $${parsedAmount.toFixed(2)} registrado`);
      setAmount("");
      setDescription("");
      setCategory("withdrawal");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error registering expense:", error);
      toast.error("Error al registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar Gasto / Retiro de Caja
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="expense-amount">Monto ($)</Label>
            <Input
              id="expense-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-description">Descripción / Motivo</Label>
            <Input
              id="expense-description"
              type="text"
              placeholder="Ej: Compra de bolsas, retiro efectivo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-category">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="expense-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="withdrawal">Retiro de efectivo</SelectItem>
                <SelectItem value="operational">Gasto operativo</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Registrando..." : "Registrar Gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CashExpenseDialog;
