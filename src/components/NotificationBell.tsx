import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNotificationsContext } from "@/contexts/NotificationsContext";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "fiado_excedido":
    case "credit_exceeded":
      return "⚠️";
    case "low_stock":
      return "📦";
    case "payment":
      return "💰";
    case "cash_closure_difference":
      return "💵";
    case "cash_closure_z":
      return "🔒";
    case "cash_opening":
      return "🔓";
    case "supervisor_override":
      return "🔑";
    case "inventory_adjustment":
      return "📊";
    case "critical_error":
      return "🚨";
    default:
      return "🔔";
  }
};

export const NotificationBell = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotificationsContext();

  const visible = notifications.slice(0, 50);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notificaciones</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificación${unreadCount > 1 ? "es" : ""} sin leer`
              : "No hay notificaciones sin leer"}
          </SheetDescription>
        </SheetHeader>

        {visible.length > 0 && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllAsRead()}
            className="w-full mt-4"
          >
            Marcar todas como leídas
          </Button>
        )}

        <ScrollArea className="h-[calc(100vh-180px)] mt-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    notification.read
                      ? "bg-background"
                      : "bg-primary/5 border-primary/20"
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <Badge variant="default" className="text-xs shrink-0">
                            Nuevo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      {notification.metadata && (
                        <div className="text-xs space-y-1 bg-secondary/50 p-2 rounded">
                          {notification.metadata.cashier_name && (
                            <p>
                              <strong>Cajero:</strong>{" "}
                              {notification.metadata.cashier_name}
                            </p>
                          )}
                          {notification.metadata.supervisor_name && (
                            <p>
                              <strong>Supervisor:</strong>{" "}
                              {notification.metadata.supervisor_name}
                            </p>
                          )}
                          {notification.metadata.customer_name && (
                            <p>
                              <strong>Cliente:</strong>{" "}
                              {notification.metadata.customer_name}
                            </p>
                          )}
                          {notification.metadata.product_name && (
                            <p>
                              <strong>Producto:</strong>{" "}
                              {notification.metadata.product_name}
                            </p>
                          )}
                          {notification.metadata.sale_total !== undefined && (
                            <p>
                              <strong>Total venta:</strong> $
                              {notification.metadata.sale_total.toFixed(2)}
                            </p>
                          )}
                          {notification.metadata.difference !== undefined && (
                            <p className={notification.metadata.difference > 0 ? "text-success" : "text-destructive"}>
                              <strong>Diferencia:</strong> $
                              {Math.abs(notification.metadata.difference).toFixed(2)}
                              {notification.metadata.difference > 0 ? " sobrante" : " faltante"}
                            </p>
                          )}
                          {notification.metadata.exceeded_by !== undefined && (
                            <p className="text-destructive">
                              <strong>Excedido por:</strong> $
                              {notification.metadata.exceeded_by.toFixed(2)}
                            </p>
                          )}
                          {notification.metadata.opening_amount !== undefined && (
                            <p>
                              <strong>Monto apertura:</strong> $
                              {notification.metadata.opening_amount.toFixed(2)}
                            </p>
                          )}
                          {notification.metadata.reason && (
                            <p>
                              <strong>Motivo:</strong>{" "}
                              {notification.metadata.reason}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(
                          new Date(notification.created_at),
                          "dd/MMM/yyyy HH:mm",
                          { locale: es }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
