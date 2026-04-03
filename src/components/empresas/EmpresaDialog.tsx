import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Users, Package, Monitor, Building2, Bot, MessageCircle } from "lucide-react";

export interface EmpresaFormData {
  nombre_empresa: string;
  rubro: string;
  email: string;
  telefono: string;
  plan: string;
  subdominio: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminPhone?: string;
}

interface EmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EmpresaFormData) => void;
  initialData?: Partial<EmpresaFormData>;
  loading?: boolean;
}

const EmpresaDialog = ({ open, onOpenChange, onSave, initialData, loading }: EmpresaDialogProps) => {
  const [form, setForm] = useState<EmpresaFormData>({
    nombre_empresa: "",
    rubro: "",
    email: "",
    telefono: "",
    plan: "",
    subdominio: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
  });

  const isCreating = !initialData;

  const { data: planes = [] } = useQuery({
    queryKey: ["planes-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15,
  });

  const selectedPlan = planes.find((p: any) => p.id === form.plan);

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
    } else {
      const defaultPlan = planes.length > 0 ? planes[0].id : "";
      setForm({ nombre_empresa: "", rubro: "", email: "", telefono: "", plan: defaultPlan, subdominio: "", adminName: "", adminEmail: "", adminPassword: "", adminPhone: "" });
    }
  }, [initialData, open, planes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const hasAdminData = !!(form.adminName && form.adminEmail && form.adminPassword);
  const adminPasswordValid = !form.adminPassword || form.adminPassword.length >= 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_empresa">Nombre *</Label>
            <Input
              id="nombre_empresa"
              value={form.nombre_empresa}
              onChange={(e) => setForm({ ...form, nombre_empresa: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubro">Rubro</Label>
            <Input
              id="rubro"
              value={form.rubro}
              onChange={(e) => setForm({ ...form, rubro: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdominio">Subdominio</Label>
              <Input
                id="subdominio"
                value={form.subdominio}
                onChange={(e) => setForm({ ...form, subdominio: e.target.value })}
              />
            </div>
          </div>
          {selectedPlan && (
            <div className="rounded-md border p-3 space-y-2 bg-muted/50">
              <p className="text-xs font-semibold text-muted-foreground">Recursos del plan "{selectedPlan.nombre}"</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {selectedPlan.max_usuarios} usuarios</span>
                <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {selectedPlan.max_productos.toLocaleString()} productos</span>
                <span className="flex items-center gap-1"><Monitor className="h-3 w-3" /> {selectedPlan.max_cajas} cajas</span>
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {selectedPlan.max_sucursales} sucursales</span>
              </div>
              <div className="flex gap-1.5">
                <Badge variant={selectedPlan.ai_asistente ? "default" : "secondary"} className="text-[10px] gap-0.5 px-1.5 py-0">
                  <Bot className="h-2.5 w-2.5" /> IA
                </Badge>
                <Badge variant={selectedPlan.whatsapp_respuestas ? "default" : "secondary"} className="text-[10px] gap-0.5 px-1.5 py-0">
                  <MessageCircle className="h-2.5 w-2.5" /> WA
                </Badge>
              </div>
            </div>
          )}

          {isCreating && (
            <>
              <Separator />
              <p className="text-sm font-semibold text-muted-foreground">Administrador de la empresa (opcional)</p>
              <div className="space-y-2">
                <Label htmlFor="adminName">Nombre completo</Label>
                <Input
                  id="adminName"
                  value={form.adminName || ""}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  placeholder="Nombre del administrador"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={form.adminEmail || ""}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Contraseña</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={form.adminPassword || ""}
                    onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                  {form.adminPassword && !adminPasswordValid && (
                    <p className="text-xs text-destructive">Mínimo 6 caracteres</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPhone">Teléfono (opcional)</Label>
                <Input
                  id="adminPhone"
                  value={form.adminPhone || ""}
                  onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.nombre_empresa.trim() || (hasAdminData && !adminPasswordValid)}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmpresaDialog;
