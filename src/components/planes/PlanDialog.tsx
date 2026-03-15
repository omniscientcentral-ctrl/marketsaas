import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { Plan } from "./PlanCard";

export interface PlanFormData {
  nombre: string;
  descripcion: string;
  max_usuarios: number;
  max_productos: number;
  max_cajas: number;
  max_sucursales: number;
  ai_asistente: boolean;
  whatsapp_respuestas: boolean;
  is_active: boolean;
}

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PlanFormData) => void;
  initialData?: Plan | null;
  loading?: boolean;
}

const defaultForm: PlanFormData = {
  nombre: "",
  descripcion: "",
  max_usuarios: 5,
  max_productos: 500,
  max_cajas: 2,
  max_sucursales: 1,
  ai_asistente: false,
  whatsapp_respuestas: false,
  is_active: true,
};

const PlanDialog = ({ open, onOpenChange, onSave, initialData, loading }: PlanDialogProps) => {
  const [form, setForm] = useState<PlanFormData>(defaultForm);

  useEffect(() => {
    if (initialData) {
      setForm({
        nombre: initialData.nombre,
        descripcion: initialData.descripcion || "",
        max_usuarios: initialData.max_usuarios,
        max_productos: initialData.max_productos,
        max_cajas: initialData.max_cajas,
        max_sucursales: initialData.max_sucursales,
        ai_asistente: initialData.ai_asistente,
        whatsapp_respuestas: initialData.whatsapp_respuestas,
        is_active: initialData.is_active,
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Plan" : "Nuevo Plan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del plan *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Profesional"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Breve descripción del plan"
            />
          </div>

          <Separator />
          <p className="text-sm font-semibold text-muted-foreground">Límites de recursos</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_usuarios">Máx. usuarios</Label>
              <Input
                id="max_usuarios"
                type="number"
                min={1}
                value={form.max_usuarios}
                onChange={(e) => setForm({ ...form, max_usuarios: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_productos">Máx. productos</Label>
              <Input
                id="max_productos"
                type="number"
                min={1}
                value={form.max_productos}
                onChange={(e) => setForm({ ...form, max_productos: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_cajas">Máx. cajas</Label>
              <Input
                id="max_cajas"
                type="number"
                min={1}
                value={form.max_cajas}
                onChange={(e) => setForm({ ...form, max_cajas: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_sucursales">Máx. sucursales</Label>
              <Input
                id="max_sucursales"
                type="number"
                min={1}
                value={form.max_sucursales}
                onChange={(e) => setForm({ ...form, max_sucursales: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <Separator />
          <p className="text-sm font-semibold text-muted-foreground">Funcionalidades</p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai_asistente" className="cursor-pointer">Asistente IA</Label>
              <Switch
                id="ai_asistente"
                checked={form.ai_asistente}
                onCheckedChange={(v) => setForm({ ...form, ai_asistente: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp" className="cursor-pointer">Respuestas WhatsApp</Label>
              <Switch
                id="whatsapp"
                checked={form.whatsapp_respuestas}
                onCheckedChange={(v) => setForm({ ...form, whatsapp_respuestas: v })}
              />
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active" className="cursor-pointer">Plan activo</Label>
            <Switch
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.nombre.trim()}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanDialog;
