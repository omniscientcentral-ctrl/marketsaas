import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

interface SupervisorPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (supervisorName?: string) => void;
  title?: string;
  description?: string;
}

export default function SupervisorPinDialog({
  open,
  onOpenChange,
  onSuccess,
  title = "Autorización de Supervisor Requerida",
  description = "Se requiere autorización de supervisor para vender productos sin stock.",
}: SupervisorPinDialogProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin || pin.length < 4) {
      toast.error("Ingrese un PIN válido (mínimo 4 dígitos)");
      return;
    }

    setLoading(true);

    try {
      // Buscar perfil con el PIN y verificar que sea supervisor o admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, default_role")
        .eq("pin", pin)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast.error("PIN incorrecto");
        setLoading(false);
        return;
      }

      // Verificar que el usuario tenga rol de supervisor o admin
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.id);

      if (rolesError) throw rolesError;

      const hasPermission = roles?.some(
        (r) => r.role === "supervisor" || r.role === "admin"
      );

      if (!hasPermission) {
        toast.error("Este usuario no tiene permisos de supervisor");
        setLoading(false);
        return;
      }

      toast.success(`Autorizado por: ${profile.full_name}`);
      setPin("");
      onSuccess(profile.full_name); // Pasar el nombre del supervisor
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error validating supervisor PIN:", error);
      toast.error("Error al validar PIN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supervisor-pin">PIN de Supervisor</Label>
            <Input
              id="supervisor-pin"
              type="password"
              placeholder="Ingrese PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={loading}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPin("");
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Autorizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
