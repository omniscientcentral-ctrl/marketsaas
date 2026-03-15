import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "./SuppliersTab";

interface SupplierDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  supplier: Supplier | null;
  empresaId?: string | null;
}

const SupplierDialog = ({ open, onClose, supplier, empresaId }: SupplierDialogProps) => {
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setTaxId(supplier.tax_id || "");
      setPhone(supplier.phone || "");
      setEmail(supplier.email || "");
      setNotes(supplier.notes || "");
      setIsActive(supplier.is_active);
    } else {
      resetForm();
    }
  }, [supplier, open]);

  const resetForm = () => {
    setName("");
    setTaxId("");
    setPhone("");
    setEmail("");
    setNotes("");
    setIsActive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setLoading(true);

    const supplierData = {
      name: name.trim(),
      tax_id: taxId.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      is_active: isActive,
    };

    if (supplier) {
      // Update
      const { error } = await supabase
        .from("suppliers")
        .update(supplierData)
        .eq("id", supplier.id);

      if (error) {
        console.error("Error updating supplier:", error);
        toast.error("Error al actualizar el proveedor");
        setLoading(false);
        return;
      }
      toast.success("Proveedor actualizado");
    } else {
      // Create
      const { error } = await supabase.from("suppliers").insert(supplierData);

      if (error) {
        console.error("Error creating supplier:", error);
        toast.error("Error al crear el proveedor");
        setLoading(false);
        return;
      }
      toast.success("Proveedor creado");
    }

    setLoading(false);
    onClose(true);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>

          {/* Tax ID (RUT) */}
          <div className="space-y-2">
            <Label>RUT</Label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="Ej: 12.345.678-9"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +56 9 1234 5678"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
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

          {/* Active Status */}
          {supplier && (
            <div className="flex items-center justify-between">
              <Label>Proveedor activo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {supplier ? "Guardar Cambios" : "Crear Proveedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierDialog;
