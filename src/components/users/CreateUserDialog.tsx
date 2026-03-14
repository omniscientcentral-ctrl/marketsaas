import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  empresaId?: string | null;
  children?: React.ReactNode;
}

const AVAILABLE_ROLES = ["admin", "supervisor", "cajero", "repositor"];

export const CreateUserDialog = ({ open, onOpenChange, onUserCreated }: CreateUserDialogProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["cajero"]);
  const [defaultRole, setDefaultRole] = useState("cajero");
  const [creating, setCreating] = useState(false);

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        const newRoles = prev.filter(r => r !== role);
        if (role === defaultRole) {
          setDefaultRole(newRoles[0] || "");
        }
        return newRoles;
      } else {
        return [...prev, role];
      }
    });
  };

  const handleCreate = async () => {
    if (!email || !password || !fullName) {
      toast.error("Email, contraseña y nombre son obligatorios");
      return;
    }

    if (password.length < 5) {
      toast.error("La contraseña debe tener al menos 5 caracteres");
      return;
    }

    if (selectedRoles.length === 0) {
      toast.error("Debe asignar al menos un rol");
      return;
    }

    if (!selectedRoles.includes(defaultRole)) {
      toast.error("El rol por defecto debe estar entre los roles asignados");
      return;
    }

    try {
      setCreating(true);

      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      // Llamar a Edge Function para crear usuario confirmado
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
          phone: phone || null,
          pin: pin || null,
          roles: selectedRoles,
          defaultRole
        }
      });

      if (error) {
        throw new Error(error.message || "Error al crear usuario");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Usuario creado correctamente. Email: ${email} - Contraseña: ${password}`, {
        duration: 10000,
      });
      onUserCreated();
      onOpenChange(false);
      
      // Reset form
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setPin("");
      setSelectedRoles(["cajero"]);
      setDefaultRole("cajero");
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
        </DialogHeader>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Importante:</strong> Asegúrate de guardar y compartir las credenciales (email y contraseña) con el nuevo usuario.
          </p>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-email">Email *</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Contraseña *</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-fullname">Nombre Completo *</Label>
            <Input
              id="create-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-phone">Teléfono</Label>
            <Input
              id="create-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-pin">PIN</Label>
            <Input
              id="create-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4 dígitos (opcional)"
              maxLength={4}
            />
          </div>

          <div className="space-y-3">
            <Label>Roles *</Label>
            {AVAILABLE_ROLES.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`create-${role}`}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => handleRoleToggle(role)}
                />
                <Label htmlFor={`create-${role}`} className="font-normal cursor-pointer capitalize">
                  {role}
                </Label>
              </div>
            ))}
          </div>

          {selectedRoles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="create-default-role">Rol por Defecto *</Label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger id="create-default-role">
                  <SelectValue placeholder="Selecciona rol por defecto" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoles.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button 
            onClick={handleCreate} 
            disabled={creating}
            className="w-full"
          >
            {creating ? "Creando..." : "Crear Usuario"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
