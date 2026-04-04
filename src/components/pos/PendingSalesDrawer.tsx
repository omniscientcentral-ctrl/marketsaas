import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Clock, Trash2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface PendingSale {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_id: string | null;
  items: any;
  total: number;
  notes: string | null;
}

interface PendingSalesDrawerProps {
  open: boolean;
  onClose: () => void;
  onLoad: (items: any[], customerName: string | null, customerId: string | null) => void;
}

const PendingSalesDrawer = ({ open, onClose, onLoad }: PendingSalesDrawerProps) => {
  const { user } = useAuth();
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPendingSales();
    }
  }, [open]);

  const fetchPendingSales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_sales")
        .select("id, created_at, customer_name, customer_id, items, total, notes")
        .eq("cashier_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingSales(data || []);
    } catch (error: any) {
      toast.error("Error al cargar ventas en espera: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (sale: PendingSale) => {
    try {
      // PRIMERO eliminar la venta en espera de la BD
      const { error } = await supabase
        .from("pending_sales")
        .delete()
        .eq("id", sale.id);

      if (error) throw error;
      
      // DESPUÉS notificar al padre (ahora fetchPendingSalesCount contará correctamente)
      onLoad(sale.items, sale.customer_name, sale.customer_id);
      
      // Refrescar lista local del drawer
      fetchPendingSales();
    } catch (error: any) {
      toast.error("Error al cargar venta: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta venta en espera?")) return;

    try {
      const { error } = await supabase
        .from("pending_sales")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Venta eliminada");
      fetchPendingSales();
    } catch (error: any) {
      toast.error("Error al eliminar venta: " + error.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ventas en Espera
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-6">
          <div className="space-y-3 pr-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : pendingSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay ventas en espera</p>
              </div>
            ) : (
              pendingSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 border rounded-lg space-y-3 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(sale.created_at), "HH:mm")}
                        </Badge>
                        {sale.customer_name && (
                          <span className="text-sm font-medium">{sale.customer_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {Array.isArray(sale.items) ? sale.items.length : 0} productos
                      </p>
                      {sale.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{sale.notes}</p>
                      )}
                    </div>
                    <p className="text-lg font-bold text-primary">
                      ${sale.total.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleLoad(sale)}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Retomar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(sale.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="pt-6 border-t">
          <Button variant="outline" onClick={onClose} className="w-full">
            Cerrar (Esc)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PendingSalesDrawer;
