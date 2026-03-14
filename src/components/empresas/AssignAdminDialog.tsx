import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });

  const { data: availableUsers = [] } = useQuery({
    queryKey: ["available-users-for-admin", empresaId, open],
    enabled: open,
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, empresa_id");
      if (error) throw error;

      // Filter: not already in this empresa
      return (profiles || []).filter(
        (p) => p.empresa_id !== empresaId
      );
    },
  });

  const handleAssignExisting = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      // Update empresa_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ empresa_id: empresaId })
        .eq("id", selectedUserId);
      if (profileError) throw profileError;

      // Upsert admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: selectedUserId, role: "admin" as any }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;

      const user = availableUsers.find((u) => u.id === selectedUserId);
      toast.success(`Administrador asignado a ${empresaNombre}`, {
        description: `${user?.full_name || ""} (${user?.email || ""})`,
      });
      setSelectedUserId("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Error al asignar administrador: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
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

        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Seleccionar existente</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">Crear nuevo</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || "Sin nombre"} — {u.email || "Sin email"}
                    </SelectItem>
                  ))}
                  {availableUsers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No hay usuarios disponibles
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssignExisting} disabled={loading || !selectedUserId}>
                {loading ? "Asignando..." : "Asignar Admin"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="new" className="pt-2">
            <form onSubmit={handleCreateNew} className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AssignAdminDialog;
