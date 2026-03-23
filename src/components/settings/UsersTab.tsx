import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Edit, Key, Power, Eye, ChevronRight, Trash2 } from "lucide-react";
import { UserEditPanel } from "@/components/users/UserEditPanel";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { UserAuditDialog } from "@/components/users/UserAuditDialog";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface UserData {
  id: string;
  full_name: string;
  phone: string | null;
  pin: string | null;
  is_active: boolean;
  default_role: string | null;
  roles: string[];
  email: string;
}

const UsersTab = () => {
  const { userRole } = useAuth();
  const empresaId = useEmpresaId();
  const { canAddUser, counts, limits } = usePlanLimits();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditUserId, setAuditUserId] = useState<string>("");

  useEffect(() => {
    fetchUsers();
  }, [empresaId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      let profilesQuery = supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (empresaId) {
        profilesQuery = profilesQuery.eq("empresa_id", empresaId);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map((profile: any) => {
        const userRoles = rolesData?.filter((r: any) => r.user_id === profile.id).map((r: any) => r.role) || [];
        
        return {
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          pin: profile.pin,
          is_active: profile.is_active,
          default_role: profile.default_role,
          roles: userRoles,
          email: profile.email || ""
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && user.is_active) ||
                         (statusFilter === "inactive" && !user.is_active);
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-destructive text-destructive-foreground",
      supervisor: "bg-primary text-primary-foreground",
      cajero: "bg-secondary text-secondary-foreground",
      repositor: "bg-accent text-accent-foreground"
    };
    return colors[role] || "bg-muted text-muted-foreground";
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus } as any)
        .eq("id", userId);

      if (error) throw error;

      toast.success(currentStatus ? "Usuario desactivado" : "Usuario activado");
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error("Error al cambiar estado del usuario");
    }
  };

  const handleResetPin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ pin: null } as any)
        .eq("id", userId);

      if (error) throw error;

      toast.success("PIN reseteado correctamente");
      fetchUsers();
    } catch (error: any) {
      console.error("Error resetting PIN:", error);
      toast.error("Error al resetear PIN");
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No hay sesión activa");
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Error al eliminar usuario");
      }

      toast.success("Usuario eliminado correctamente");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error al eliminar usuario");
    }
  };

  const showAudit = (userId: string) => {
    setAuditUserId(userId);
    setShowAuditDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-muted-foreground">Administra usuarios, roles y permisos</p>
        </div>
        
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="cajero">Cajero</SelectItem>
            <SelectItem value="repositor">Repositor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla Desktop */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Cargando usuarios...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.map(role => (
                        <Badge key={role} className={getRoleColor(role)}>
                          {role}
                          {user.default_role === role && " ★"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                          <SheetHeader>
                            <SheetTitle>Editar Usuario</SheetTitle>
                          </SheetHeader>
                           {selectedUser && (
                             <UserEditPanel
                               user={selectedUser}
                               onUpdate={fetchUsers}
                               onClose={() => setSelectedUser(null)}
                             />
                           )}
                        </SheetContent>
                      </Sheet>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPin(user.id)}
                        title="Reset PIN"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        title={user.is_active ? "Desactivar" : "Activar"}
                      >
                        <Power className={user.is_active ? "h-4 w-4 text-destructive" : "h-4 w-4 text-green-600"} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => showAudit(user.id)}
                        title="Ver auditoría"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                        title="Eliminar usuario"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tarjetas Mobile */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8">Cargando usuarios...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron usuarios
          </div>
        ) : (
          filteredUsers.map((user) => (
            <Sheet key={user.id}>
              <SheetTrigger asChild>
                <div 
                  className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles.map(role => (
                      <Badge key={role} className={getRoleColor(role)}>
                        {role}
                        {user.default_role === role && " ★"}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Editar Usuario</SheetTitle>
                </SheetHeader>
                 {selectedUser && (
                   <UserEditPanel
                     user={selectedUser}
                     onUpdate={fetchUsers}
                     onClose={() => setSelectedUser(null)}
                   />
                 )}
              </SheetContent>
            </Sheet>
          ))
        )}
      </div>

      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onUserCreated={fetchUsers}
        empresaId={empresaId}
      />

      <UserAuditDialog
        open={showAuditDialog}
        onOpenChange={setShowAuditDialog}
        userId={auditUserId}
      />
    </div>
  );
};

export default UsersTab;
