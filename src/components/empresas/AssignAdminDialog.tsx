import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AssignAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaNombre: string;
  onSuccess: () => void;
}

const AssignAdminDialog = ({ open, onOpenChange, empresaId, empresaNombre, onSuccess }: AssignAdminDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) return;
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          phone: form.phone || undefined,
          roles: ["admin"],
          defaultRole: "admin",
          empresaId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Administrador asignado a ${empresaNombre}`, {
        description: `Email: ${form.email}`,
      });
      setForm({ fullName: "", email: "", password: "", phone: "" });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Error al crear administrador: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Administrador</DialogTitle>
          <p className="text-sm text-muted-foreground">Empresa: {empresaNombre}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-fullName">Nombre completo *</Label>
            <Input
              id="assign-fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-email">Email *</Label>
            <Input
              id="assign-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-password">Contraseña *</Label>
            <Input
              id="assign-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-phone">Teléfono</Label>
            <Input
              id="assign-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.fullName || !form.email || !form.password || form.password.length < 6}>
              {loading ? "Creando..." : "Crear Administrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AssignAdminDialog;
