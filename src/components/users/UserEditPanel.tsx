import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserEditPanelProps {
  user: {
    id: string;
    full_name: string;
    phone: string | null;
    pin: string | null;
    is_active: boolean;
    default_role: string | null;
    roles: string[];
    email: string;
  };
  onUpdate: () => void;
  onClose?: () => void;
}

const AVAILABLE_ROLES = ["admin", "supervisor", "cajero", "repositor"];

export const UserEditPanel = ({ user, onUpdate, onClose }: UserEditPanelProps) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [pin, setPin] = useState(user.pin || "");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const [defaultRole, setDefaultRole] = useState(user.default_role || "");
  const [canEditPrice, setCanEditPrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFullName(user.full_name);
    setEmail(user.email);
    setPassword("");
    setPhone(user.phone || "");
    setPin(user.pin || "");
    setSelectedRoles(user.roles);
    setDefaultRole(user.default_role || "");
    
    // Cargar el permiso can_edit_price
    const fetchPricePermission = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("can_edit_price")
        .eq("id", user.id)
        .single();
      
      setCanEditPrice(data?.can_edit_price || false);
    };
    
    fetchPricePermission();
  }, [user]);

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        const newRoles = prev.filter(r => r !== role);
        // Si se quita el rol por defecto, resetear
        if (role === defaultRole) {
          setDefaultRole(newRoles[0] || "");
        }
        return newRoles;
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      toast.error("Debe asignar al menos un rol");
      return;
    }

    if (defaultRole && !selectedRoles.includes(defaultRole)) {
      toast.error("El rol por defecto debe estar entre los roles asignados");
      return;
    }

    // Validar email
    if (!email || !email.includes('@')) {
      toast.error("Email inválido");
      return;
    }

    // Validar contraseña si se proporciona
    if (password && password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setSaving(true);

      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      // Si el email o contraseña cambiaron, actualizarlos usando Edge Function
      if (email !== user.email || password) {
        const { data: updateData, error: updateError } = await supabase.functions.invoke('update-user-credentials', {
          body: {
            userId: user.id,
            newEmail: email !== user.email ? email : undefined,
            newPassword: password || undefined
          }
        });

        if (updateError || updateData?.error) {
          throw new Error(updateData?.error || updateError?.message || "Error al actualizar credenciales");
        }
      }

      // Actualizar perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          pin: pin || null,
          default_role: defaultRole || selectedRoles[0],
          email: email,
          can_edit_price: canEditPrice,
          price_edit_unlocked_at: new Date().toISOString()
        } as any)
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Obtener roles actuales
      const { data: currentRolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const currentRoles = currentRolesData?.map((r: any) => r.role) || [];

      // Roles a agregar
      const rolesToAdd = selectedRoles.filter(r => !currentRoles.includes(r as any));
      // Roles a eliminar
      const rolesToRemove = currentRoles.filter((r: any) => !selectedRoles.includes(r));

      // Obtener usuario actual para auditoría
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Agregar nuevos roles
      for (const role of rolesToAdd) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role } as any);

        if (roleError) throw roleError;

        // Registrar en auditoría
        await supabase.from("role_assignment_logs").insert({
          user_id: user.id,
          role,
          action: "add",
          assigned_by: currentUser?.id
        } as any);
      }

      // Eliminar roles
      for (const role of rolesToRemove) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .eq("role", role);

        if (roleError) throw roleError;

        // Registrar en auditoría
        await supabase.from("role_assignment_logs").insert({
          user_id: user.id,
          role,
          action: "remove",
          assigned_by: currentUser?.id
        } as any);
      }

      toast.success("Usuario actualizado correctamente");
      onUpdate();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Error al actualizar usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Error al eliminar usuario");
      }

      toast.success("Usuario eliminado correctamente");
      onUpdate();
      onClose?.();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Datos básicos del usuario</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre Completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Usuario de Login)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
            />
            <p className="text-sm text-muted-foreground">
              Este email se usará como nombre de usuario para iniciar sesión
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nueva Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
            />
            <p className="text-sm text-muted-foreground">
              Mínimo 6 caracteres. Dejar vacío si no desea cambiarla.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN de 4 dígitos (opcional)"
              maxLength={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permisos Especiales</CardTitle>
          <CardDescription>Permisos adicionales del usuario</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="can_edit_price" className="text-base">
                Editar Precios en POS
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite modificar precios de productos durante la venta
              </p>
            </div>
            <Switch
              id="can_edit_price"
              checked={canEditPrice}
              onCheckedChange={setCanEditPrice}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles y Permisos</CardTitle>
          <CardDescription>Asigna roles al usuario (multi-selección)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {AVAILABLE_ROLES.map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={role}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => handleRoleToggle(role)}
                />
                <Label htmlFor={role} className="font-normal cursor-pointer capitalize">
                  {role}
                </Label>
              </div>
            ))}
          </div>

          {selectedRoles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="defaultRole">Rol por Defecto</Label>
                <Select value={defaultRole} onValueChange={setDefaultRole}>
                  <SelectTrigger id="defaultRole">
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
                <p className="text-sm text-muted-foreground">
                  Este será el rol activo cuando el usuario inicie sesión
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button 
          onClick={handleSave} 
          disabled={saving || deleting}
          className="flex-1"
        >
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              disabled={saving || deleting}
              size="icon"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente al usuario "{user.full_name}" y todos sus datos asociados. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
