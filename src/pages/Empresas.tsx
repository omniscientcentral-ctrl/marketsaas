import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmpresaDialog from "@/components/empresas/EmpresaDialog";
import { format } from "date-fns";

const Empresas = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("empresas").insert({
        nombre_empresa: data.nombre_empresa,
        rubro: data.rubro || null,
        email: data.email || null,
        telefono: data.telefono || null,
        plan: data.plan || "basic",
        subdominio: data.subdominio || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa creada");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setDialogOpen(false);
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rubro</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.nombre_empresa}</TableCell>
                      <TableCell>{e.rubro || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{e.plan || "basic"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.estado === "activa" ? "default" : "destructive"}>
                          {e.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.email || "—"}</TableCell>
                      <TableCell>{e.telefono || "—"}</TableCell>
                      <TableCell>
                        {e.fecha_creacion ? format(new Date(e.fecha_creacion), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
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
                  ))}
                </TableBody>
              </Table>
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
    </MainLayout>
  );
};

export default Empresas;
