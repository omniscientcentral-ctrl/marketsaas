import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCheck, Archive, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warn' | 'critical';
  read: boolean;
  archived: boolean;
  actor_user_id?: string;
  actor_role?: string;
  target_type?: string;
  target_id?: string;
  related_sale_id?: string;
  related_customer_id?: string;
  metadata?: any;
  created_at: string;
}

export const AdminNotificationCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const fetchNotifications = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications((data || []) as Notification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    
    fetchNotifications();
    
    // Realtime subscription
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );

      // Create audit
      await supabase.from('notification_audit').insert({
        notification_id: notificationId,
        action: 'read',
        performed_by: user?.id
      });
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Error al marcar como leída');
    }
  };

  const markAllAsRead = async (tab: string) => {
    try {
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .eq('archived', false);

      if (tab === 'critical') {
        query = query.eq('severity', 'critical');
      } else if (tab === 'operational') {
        query = query.in('severity', ['info', 'warn']);
      }

      const { error } = await query;
      if (error) throw error;

      await fetchNotifications();
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Error al marcar todas como leídas');
    }
  };

  const archiveNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ archived: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, archived: true } : n)
      );

      // Create audit
      await supabase.from('notification_audit').insert({
        notification_id: notificationId,
        action: 'archived',
        performed_by: user?.id
      });

      toast.success('Notificación archivada');
    } catch (error) {
      console.error('Error archiving notification:', error);
      toast.error('Error al archivar');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warn':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const filterNotifications = (notifs: Notification[], tab: string) => {
    let filtered = notifs.filter(n => !n.archived);

    if (tab === 'critical') {
      filtered = filtered.filter(n => n.severity === 'critical');
    } else if (tab === 'operational') {
      filtered = filtered.filter(n => n.severity === 'info' || n.severity === 'warn');
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType);
    }

    if (filterSeverity !== 'all') {
      filtered = filtered.filter(n => n.severity === filterSeverity);
    }

    return filtered;
  };

  const getCounts = () => {
    const unarchived = notifications.filter(n => !n.archived);
    return {
      all: unarchived.length,
      critical: unarchived.filter(n => n.severity === 'critical' && !n.read).length,
      operational: unarchived.filter(n => (n.severity === 'info' || n.severity === 'warn') && !n.read).length,
    };
  };

  const counts = getCounts();

  const renderNotifications = (notifs: Notification[]) => {
    if (loading) {
      return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;
    }

    if (notifs.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">No hay notificaciones</div>;
    }

    return (
      <ScrollArea className="h-[600px]">
        <div className="space-y-4 pr-4">
          {notifs.map((notification) => (
            <Card key={notification.id} className={!notification.read ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(notification.severity)}
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base">{notification.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {notification.message}
                      </CardDescription>
                      <div className="flex items-center gap-2 flex-wrap pt-2">
                        <Badge variant={getSeverityColor(notification.severity)}>
                          {notification.severity}
                        </Badge>
                        <Badge variant="outline">{notification.type}</Badge>
                        {notification.actor_role && (
                          <Badge variant="outline">
                            {notification.actor_role}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), "PPp", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsRead(notification.id)}
                        title="Marcar como leída"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => archiveNotification(notification.id)}
                      title="Archivar"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                <CardContent className="pt-0">
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Ver detalles</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(notification.metadata, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Centro de Notificaciones</CardTitle>
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="cash_opening">Apertura caja</SelectItem>
                <SelectItem value="cash_closure_difference">Cierre con diferencia</SelectItem>
                <SelectItem value="cash_closure_z">Cierre de caja</SelectItem>
                <SelectItem value="cash_takeover">Relevo</SelectItem>
                <SelectItem value="forced_closure">Cierre forzado</SelectItem>
                <SelectItem value="sale_cancelled">Venta anulada</SelectItem>
                <SelectItem value="return_with_refund">Devolución</SelectItem>
                <SelectItem value="price_override">Precio modificado</SelectItem>
                <SelectItem value="credit_limit_exceeded">Límite excedido</SelectItem>
                <SelectItem value="stock_adjustment">Ajuste stock</SelectItem>
                <SelectItem value="wastage">Merma</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Advertencia</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription>
          Todas las notificaciones del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">
                Todas
                {counts.all > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {counts.all}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="critical">
                Críticas
                {counts.critical > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {counts.critical}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="operational">
                Operativas
                {counts.operational > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {counts.operational}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead('all')}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Marcar todas como leídas
                </Button>
              </div>
              {renderNotifications(filterNotifications(notifications, 'all'))}
            </div>
          </TabsContent>

          <TabsContent value="critical">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead('critical')}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Marcar todas como leídas
                </Button>
              </div>
              {renderNotifications(filterNotifications(notifications, 'critical'))}
            </div>
          </TabsContent>

          <TabsContent value="operational">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead('operational')}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Marcar todas como leídas
                </Button>
              </div>
              {renderNotifications(filterNotifications(notifications, 'operational'))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
