import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CashRegisterHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: any | null;
}

interface CashRegisterSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  difference: number | null;
  status: string;
  cashier_id: string;
  profiles?: {
    full_name: string;
  };
}

export const CashRegisterHistoryDialog = ({ open, onOpenChange, register }: CashRegisterHistoryDialogProps) => {
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && register) {
      loadHistory();
    }
  }, [open, register]);

  const loadHistory = async () => {
    if (!register) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_register')
        .select(`
          id,
          opened_at,
          closed_at,
          opening_amount,
          closing_amount,
          difference,
          status,
          cashier_id
        `)
        .eq('cash_register_id', register.id)
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Obtener nombres de los cajeros
      const cashierIds = [...new Set(data?.map(s => s.cashier_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', cashierIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const sessionsWithProfiles = data?.map(session => ({
        ...session,
        profiles: profilesMap.get(session.cashier_id)
      })) || [];

      setSessions(sessionsWithProfiles);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de {register?.name}</DialogTitle>
          <DialogDescription>
            Últimas 50 sesiones de esta caja
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apertura</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead>Cajero</TableHead>
                <TableHead className="text-right">Apertura $</TableHead>
                <TableHead className="text-right">Cierre $</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay historial para esta caja
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {format(new Date(session.opened_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      {session.closed_at 
                        ? format(new Date(session.closed_at), "dd/MM/yyyy HH:mm", { locale: es })
                        : "-"}
                    </TableCell>
                    <TableCell>{session.profiles?.full_name || "-"}</TableCell>
                    <TableCell className="text-right">
                      ${session.opening_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.closing_amount !== null 
                        ? `$${session.closing_amount.toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.difference !== null ? (
                        <span className={session.difference !== 0 ? "text-destructive font-semibold" : ""}>
                          ${session.difference.toFixed(2)}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
