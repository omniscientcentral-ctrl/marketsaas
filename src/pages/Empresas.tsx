import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2, UserPlus, Pencil, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmpresaDialog from "@/components/empresas/EmpresaDialog";
import type { EmpresaFormData } from "@/components/empresas/EmpresaDialog";
import AssignAdminDialog from "@/components/empresas/AssignAdminDialog";
import { format } from "date-fns";

const Empresas = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<{ id: string; data: Partial<EmpresaFormData> } | null>(null);
  const [assignAdminOpen, setAssignAdminOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<{ id: string; nombre: string } | null>(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*, planes:plan(id, nombre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Query admins per empresa
  const { data: adminsByEmpresa = {} } = useQuery({
    queryKey: ["empresas-admins"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, empresa_id");
      if (error) throw error;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      const adminUserIds = new Set(
        roles?.filter((r: any) => r.role === "admin").map((r: any) => r.user_id) || []
      );

      const map: Record<string, { full_name: string; email: string }[]> = {};
      for (const p of profiles || []) {
        if (p.empresa_id && adminUserIds.has(p.id)) {
          if (!map[p.empresa_id]) map[p.empresa_id] = [];
          map[p.empresa_id].push({ full_name: p.full_name || "", email: p.email || "" });
        }
      }
      return map;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmpresaFormData) => {
      // 1. Create empresa
      const { data: empresa, error } = await supabase
        .from("empresas")
        .insert({
          nombre_empresa: data.nombre_empresa,
          rubro: data.rubro || null,
          email: data.email || null,
          telefono: data.telefono || null,
          plan: data.plan || null,
          subdominio: data.subdominio || null,
        })
        .select()
        .single();
      if (error) throw error;

      // 2. If admin data provided, create admin user
      if (data.adminName && data.adminEmail && data.adminPassword) {
        const { data: result, error: fnError } = await supabase.functions.invoke("create-user", {
          body: {
            email: data.adminEmail,
            password: data.adminPassword,
            fullName: data.adminName,
            phone: data.adminPhone || undefined,
            roles: ["admin"],
            defaultRole: "admin",
            empresaId: empresa.id,
          },
        });

        if (fnError) throw fnError;
        if (result?.error) throw new Error(result.error);

        return { empresa, adminEmail: data.adminEmail, adminPassword: data.adminPassword };
      }

      return { empresa };
    },
    onSuccess: (result) => {
      if (result.adminEmail) {
        toast.success("Empresa creada con administrador", {
          description: `Admin: ${result.adminEmail}`,
          duration: 8000,
        });
      } else {
        toast.success("Empresa creada");
      }
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas-admins"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EmpresaFormData }) => {
      const { error } = await supabase
        .from("empresas")
        .update({
          nombre_empresa: data.nombre_empresa,
          rubro: data.rubro || null,
          email: data.email || null,
          telefono: data.telefono || null,
          plan: data.plan || null,
          subdominio: data.subdominio || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa actualizada");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setEditingEmpresa(null);
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const toggleEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const newEstado = estado === "activa" ? "suspendida" : "activa";
      const { error } = await supabase.from("empresas").update({ estado: newEstado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });

  const openAssignAdmin = (empresaId: string, nombre: string) => {
    setSelectedEmpresa({ id: empresaId, nombre });
    setAssignAdminOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Empresas</h1>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Cargando...</p>
            ) : empresas.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay empresas registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Administrador</TableHead>
                      <TableHead>Rubro</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.map((e) => {
                      const admins = adminsByEmpresa[e.id] || [];
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.nombre_empresa}</TableCell>
                          <TableCell>
                            {admins.length > 0 ? (
                              <div className="space-y-1">
                                {admins.map((a, i) => (
                                  <div key={i} className="text-sm">
                                    <span className="font-medium">{a.full_name}</span>
                                    <br />
                                    <span className="text-muted-foreground text-xs">{a.email}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Sin admin</span>
                            )}
                          </TableCell>
                          <TableCell>{e.rubro || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{(e as any).planes?.nombre || "Sin plan"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={e.estado === "activa" ? "default" : "destructive"}>
                              {e.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{e.email || "—"}</TableCell>
                          <TableCell>
                            {e.fecha_creacion ? format(new Date(e.fecha_creacion), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingEmpresa({
                                id: e.id,
                                data: {
                                  nombre_empresa: e.nombre_empresa,
                                  rubro: e.rubro || "",
                                  email: e.email || "",
                                  telefono: e.telefono || "",
                                  plan: e.plan || "",
                                  subdominio: e.subdominio || "",
                                },
                              })}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignAdmin(e.id, e.nombre_empresa)}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Asignar Admin
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/empresas/backup?empresa=${e.id}`)}
                            >
                              <Database className="h-3.5 w-3.5 mr-1" />
                              Respaldos
                            </Button>
                            <Button
                              variant={e.estado === "activa" ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleEstadoMutation.mutate({ id: e.id, estado: e.estado })}
                              disabled={toggleEstadoMutation.isPending}
                            >
                              {e.estado === "activa" ? "Suspender" : "Activar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EmpresaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      <EmpresaDialog
        open={!!editingEmpresa}
        onOpenChange={(open) => { if (!open) setEditingEmpresa(null); }}
        onSave={(data) => editingEmpresa && updateMutation.mutate({ id: editingEmpresa.id, data })}
        initialData={editingEmpresa?.data}
        loading={updateMutation.isPending}
      />

      {selectedEmpresa && (
        <AssignAdminDialog
          open={assignAdminOpen}
          onOpenChange={setAssignAdminOpen}
          empresaId={selectedEmpresa.id}
          empresaNombre={selectedEmpresa.nombre}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["empresas-admins"] });
          }}
        />
      )}
    </MainLayout>
  );
};

export default Empresas;
