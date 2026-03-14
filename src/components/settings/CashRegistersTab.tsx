import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, History, Power } from "lucide-react";
import { toast } from "sonner";
import { CashRegisterDialog } from "@/components/cash-registers/CashRegisterDialog";
import { CashRegisterHistoryDialog } from "@/components/cash-registers/CashRegisterHistoryDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface CashRegister {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CashRegistersTab = () => {
  const { user } = useAuth();
  const empresaId = useEmpresaId();
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registerToDelete, setRegisterToDelete] = useState<CashRegister | null>(null);

  useEffect(() => {
    loadCashRegisters();
  }, []);

  const loadCashRegisters = async () => {
    try {
      let query = supabase
        .from('cash_registers')
        .select('*')
        .order('created_at', { ascending: false });

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === 'PGRST301' || error.message.includes('permission')) {
          toast.error("No hay permisos de base de datos para listar cajas (admin)");
        } else {
          toast.error("Error al cargar las cajas");
        }
        throw error;
      }
      setCashRegisters(data || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (register: CashRegister) => {
    try {
      if (register.is_active) {
        const { data: openSession } = await supabase
          .from('cash_register')
          .select('id')
          .eq('cash_register_id', register.id)
          .eq('status', 'open')
          .maybeSingle();

        if (openSession) {
          toast.error("No se puede desactivar una caja con sesión abierta. Cerrá la caja primero.");
          return;
        }
      }

      const { error } = await supabase
        .from('cash_registers')
        .update({ is_active: !register.is_active })
        .eq('id', register.id);

      if (error) throw error;

      await supabase.from('cash_register_audit').insert({
        cash_register_id: register.id,
        action: register.is_active ? 'deactivate' : 'activate',
        performed_by: user?.id,
        details: { name: register.name }
      });

      toast.success(register.is_active ? "Caja desactivada" : "Caja activada");
      loadCashRegisters();
    } catch (error: any) {
      toast.error("Error al cambiar estado de la caja");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!registerToDelete) return;

    try {
      const { data: openSession } = await supabase
        .from('cash_register')
        .select('id')
        .eq('cash_register_id', registerToDelete.id)
        .eq('status', 'open')
        .maybeSingle();

      if (openSession) {
        toast.error("No se puede eliminar una caja con sesión abierta");
        setDeleteDialogOpen(false);
        return;
      }

      if (registerToDelete.is_active) {
        toast.error("No se puede eliminar una caja activa. Desactivala primero.");
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from('cash_registers')
        .delete()
        .eq('id', registerToDelete.id);

      if (error) throw error;

      await supabase.from('cash_register_audit').insert({
        cash_register_id: registerToDelete.id,
        action: 'delete',
        performed_by: user?.id,
        details: { name: registerToDelete.name }
      });

      toast.success("Caja eliminada correctamente");
      loadCashRegisters();
    } catch (error: any) {
      toast.error("Error al eliminar la caja");
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setRegisterToDelete(null);
    }
  };

  const confirmDelete = (register: CashRegister) => {
    setRegisterToDelete(register);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Cajas</CardTitle>
              <CardDescription>
                Administrá los puntos de cobro de tu negocio
              </CardDescription>
            </div>
            <Button onClick={() => { setSelectedRegister(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Caja
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashRegisters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay cajas registradas
                  </TableCell>
                </TableRow>
              ) : (
                cashRegisters.map((register) => (
                  <TableRow key={register.id}>
                    <TableCell className="font-medium">{register.name}</TableCell>
                    <TableCell>{register.location || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {register.is_active ? "Disponible" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {register.is_active ? (
                        <Badge variant="default">Sí</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedRegister(register); setDialogOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(register)}
                        >
                          <Power className={register.is_active ? "h-4 w-4 text-green-600" : "h-4 w-4 text-gray-400"} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedRegister(register); setHistoryDialogOpen(true); }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(register)}
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
        </CardContent>
      </Card>

      <CashRegisterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        register={selectedRegister}
        onSuccess={loadCashRegisters}
      />

      <CashRegisterHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        register={selectedRegister}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar caja?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo podés eliminar cajas que estén desactivadas y sin sesiones abiertas.
              {registerToDelete?.is_active && (
                <span className="block mt-2 text-destructive font-semibold">
                  ⚠️ Esta caja está activa. Desactivala primero.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashRegistersTab;
