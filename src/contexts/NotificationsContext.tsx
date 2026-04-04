import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warn" | "critical";
  read: boolean;
  archived: boolean;
  actor_role?: string;
  created_at: string;
  metadata?: any;
  related_sale_id?: string | null;
  related_customer_id?: string | null;
}

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (tab?: string) => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const useNotificationsContext = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsContext must be used within NotificationsProvider");
  return ctx;
};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, type, title, message, severity, read, archived, actor_role, created_at, metadata, related_sale_id, related_customer_id"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications((data || []) as Notification[]);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      await supabase.from("notification_audit").insert({
        notification_id: id,
        action: "read",
        performed_by: user?.id,
      });
    } catch (error: any) {
      toast.error("Error al marcar como leída");
    }
  };

  const markAllAsRead = async (tab = "all") => {
    try {
      let query = supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .eq("archived", false);

      if (tab === "critical") {
        query = query.eq("severity", "critical");
      } else if (tab === "operational") {
        query = query.in("severity", ["info", "warn"]);
      }

      const { error } = await query;
      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => {
          if (n.read || n.archived) return n;
          if (tab === "critical" && n.severity !== "critical") return n;
          if (tab === "operational" && n.severity === "critical") return n;
          return { ...n, read: true };
        })
      );
      toast.success("Todas las notificaciones marcadas como leídas");
    } catch (error: any) {
      toast.error("Error al marcar todas como leídas");
    }
  };

  const archiveNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ archived: true })
        .eq("id", id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, archived: true } : n))
      );

      await supabase.from("notification_audit").insert({
        notification_id: id,
        action: "archived",
        performed_by: user?.id,
      });

      toast.success("Notificación archivada");
    } catch (error: any) {
      toast.error("Error al archivar");
    }
  };

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, archiveNotification }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
