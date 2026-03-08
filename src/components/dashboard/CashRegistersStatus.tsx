import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { CashRegisterStatus } from "@/hooks/useDashboardData";

interface CashRegistersStatusProps {
  data: CashRegisterStatus[];
  loading: boolean;
}

export const CashRegistersStatus = ({ data, loading }: CashRegistersStatusProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Estado de Cajas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="min-w-[200px] p-3 rounded-lg border">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Estado de Cajas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay cajas registradas en el sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Estado de Cajas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {data.map((register) => (
            <div
              key={register.id}
              className={`min-w-[200px] p-3 rounded-lg border ${
                register.isOpen
                  ? "border-success/50 bg-success/5"
                  : "border-muted bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{register.name}</span>
                <Badge
                  variant={register.isOpen ? "default" : "secondary"}
                  className={register.isOpen ? "bg-success text-success-foreground" : ""}
                >
                  {register.isOpen ? "Abierta" : "Cerrada"}
                </Badge>
              </div>
              {register.isOpen && (
                <>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <User className="h-3 w-3" />
                    <span>{register.openByUser || "Desconocido"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {register.openedAt
                        ? format(new Date(register.openedAt), "HH:mm", { locale: es })
                        : "--:--"}
                    </span>
                  </div>
                </>
              )}
              {register.location && (
                <p className="text-xs text-muted-foreground mt-1">
                  {register.location}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
