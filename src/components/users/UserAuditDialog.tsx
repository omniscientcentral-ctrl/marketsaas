import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface AuditLog {
  id: string;
  role: string;
  action: string;
  created_at: string;
  assigned_by_name: string;
}

interface UserAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const UserAuditDialog = ({ open, onOpenChange, userId }: UserAuditDialogProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchAuditLogs();
    }
  }, [open, userId]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("role_assignment_logs")
        .select(`
          id,
          role,
          action,
          created_at,
          assigned_by
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Obtener nombres de quienes asignaron
      const assignedByIds = [...new Set(data?.map(l => l.assigned_by) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", assignedByIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const logsWithNames = data?.map(log => ({
        ...log,
        assigned_by_name: profilesMap.get(log.assigned_by) || "Desconocido"
      })) || [];

      setLogs(logsWithNames);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoría de Roles</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando historial...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay cambios registrados
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={log.action === "add" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {log.role}
                    </Badge>
                    <span className="text-sm font-medium">
                      {log.action === "add" ? "Agregado" : "Eliminado"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Por: {log.assigned_by_name}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), { 
                    addSuffix: true,
                    locale: es 
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
