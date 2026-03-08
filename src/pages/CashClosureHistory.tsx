import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getHomePathForRole } from "@/config/navigation";

export default function CashClosureHistory() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [closures, setClosures] = useState<any[]>([]);
  const [selectedClosure, setSelectedClosure] = useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    loadClosures();
  }, [user, navigate, filterStatus]);

  const loadClosures = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("cash_register")
        .select(`
          *,
          profiles:cashier_id (full_name),
          supervisor:supervisor_id (full_name)
        `)
        .neq("status", "open")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Si no es admin ni supervisor, solo mostrar sus propios cierres
      if (activeRole !== "admin" && activeRole !== "supervisor") {
        query = query.eq("cashier_id", user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setClosures(data || []);
    } catch (error: any) {
      console.error("Error loading closures:", error);
      toast.error("Error al cargar historial de cierres");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedClosure) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("cash_register")
        .update({
          status: "closed",
          supervisor_id: user?.id,
          supervisor_approved_at: new Date().toISOString(),
        })
        .eq("id", selectedClosure.id);

      if (error) throw error;

      toast.success("Cierre aprobado exitosamente");
      setShowApprovalDialog(false);
      setSelectedClosure(null);
      loadClosures();
    } catch (error: any) {
      console.error("Error approving closure:", error);
      toast.error("Error al aprobar el cierre");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedClosure) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("cash_register")
        .update({
          status: "rejected",
          supervisor_id: user?.id,
          supervisor_approved_at: new Date().toISOString(),
        })
        .eq("id", selectedClosure.id);

      if (error) throw error;

      toast.success("Cierre rechazado");
      setShowApprovalDialog(false);
      setSelectedClosure(null);
      loadClosures();
    } catch (error: any) {
      console.error("Error rejecting closure:", error);
      toast.error("Error al rechazar el cierre");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: any; icon: any }> = {
      closed: { label: "Cerrado", variant: "default", icon: CheckCircle2 },
      pending_approval: { label: "Pendiente", variant: "secondary", icon: Clock },
      rejected: { label: "Rechazado", variant: "destructive", icon: XCircle },
    };

    const { label, variant, icon: Icon } = config[status] || config.closed;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  if (loading && closures.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(getHomePathForRole(activeRole))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Historial de Cierres</h1>
            <p className="text-muted-foreground">Arqueos y cierres de caja registrados</p>
          </div>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Filtrar por Estado</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === "closed" ? "default" : "outline"}
                onClick={() => setFilterStatus("closed")}
                size="sm"
              >
                Cerrados
              </Button>
              <Button
                variant={filterStatus === "pending_approval" ? "default" : "outline"}
                onClick={() => setFilterStatus("pending_approval")}
                size="sm"
              >
                Pendientes
              </Button>
              <Button
                variant={filterStatus === "rejected" ? "default" : "outline"}
                onClick={() => setFilterStatus("rejected")}
                size="sm"
              >
                Rechazados
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Cajero</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>Esperado</TableHead>
              <TableHead>Contado</TableHead>
              <TableHead>Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => {
              const difference = Number(closure.difference || 0);
              return (
                <TableRow key={closure.id}>
                  <TableCell>
                    {format(new Date(closure.closed_at || closure.opened_at), "dd/MM/yy HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell>{closure.profiles?.full_name || "N/A"}</TableCell>
                  <TableCell>{closure.ticket_count || 0}</TableCell>
                  <TableCell>${Number(closure.expected_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(closure.closing_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <span
                      className={`font-bold ${
                        difference === 0
                          ? "text-green-600"
                          : difference > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {difference > 0 ? "+" : ""}
                      {difference.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(closure.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClosure(closure);
                          setShowApprovalDialog(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      {closure.status === "pending_approval" &&
                        (activeRole === "admin" || activeRole === "supervisor") && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedClosure(closure);
                              setShowApprovalDialog(true);
                            }}
                          >
                            Revisar
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del Cierre</DialogTitle>
            <DialogDescription>
              Información completa del arqueo de caja
            </DialogDescription>
          </DialogHeader>

          {selectedClosure && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cajero</p>
                  <p className="font-semibold">{selectedClosure.profiles?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getStatusBadge(selectedClosure.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Apertura</p>
                  <p className="font-semibold">
                    {format(new Date(selectedClosure.opened_at), "dd/MM/yyyy HH:mm", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cierre</p>
                  <p className="font-semibold">
                    {selectedClosure.closed_at
                      ? format(new Date(selectedClosure.closed_at), "dd/MM/yyyy HH:mm", { locale: es })
                      : "N/A"}
                  </p>
                </div>
              </div>

              <Card className="p-4 bg-muted">
                <h4 className="font-semibold mb-3">Resumen Financiero</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Monto de apertura:</span>
                    <span className="font-semibold">${Number(selectedClosure.opening_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efectivo esperado:</span>
                    <span className="font-semibold">${Number(selectedClosure.expected_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Efectivo contado:</span>
                    <span className="font-semibold">${Number(selectedClosure.closing_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventas con tarjeta:</span>
                    <span className="font-semibold">${Number(selectedClosure.card_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ventas a crédito:</span>
                    <span className="font-semibold">${Number(selectedClosure.credit_sales_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-bold">Diferencia:</span>
                    <span
                      className={`font-bold ${
                        Number(selectedClosure.difference || 0) === 0
                          ? "text-green-600"
                          : Number(selectedClosure.difference || 0) > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {Number(selectedClosure.difference || 0) > 0 ? "+" : ""}
                      {Number(selectedClosure.difference || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>

              {selectedClosure.difference_reason && (
                <Card className="p-4 bg-yellow-500/10">
                  <p className="text-sm font-semibold mb-1">Motivo de la diferencia:</p>
                  <p className="text-sm">{selectedClosure.difference_reason}</p>
                </Card>
              )}

              {selectedClosure.notes && (
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-1">Notas adicionales:</p>
                  <p className="text-sm">{selectedClosure.notes}</p>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedClosure?.status === "pending_approval" &&
              (activeRole === "admin" || activeRole === "supervisor") && (
                <div className="flex gap-2 w-full">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechazar"}
                  </Button>
                  <Button onClick={handleApprove} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprobar"}
                  </Button>
                </div>
              )}
            {selectedClosure?.status !== "pending_approval" && (
              <Button onClick={() => setShowApprovalDialog(false)}>Cerrar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
