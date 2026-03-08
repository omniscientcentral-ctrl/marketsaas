import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export const EXPIRATION_THRESHOLDS = {
  CRITICAL: 7,    // Rojo: ≤7 días
  WARNING: 15,    // Naranja: 8-15 días  
  NOTICE: 30,     // Amarillo: 16-30 días
};

export interface ExpirationInfo {
  daysUntilExpiration: number;
  nearestExpirationDate: string;
  quantity: number;
  severity: "critical" | "warning" | "notice";
}

export function useProductExpiration(productId: string | null) {
  const [expirationInfo, setExpirationInfo] = useState<ExpirationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) {
      setExpirationInfo(null);
      return;
    }

    const fetchExpirationInfo = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const futureLimit = new Date();
        futureLimit.setDate(today.getDate() + EXPIRATION_THRESHOLDS.NOTICE);

        const { data, error } = await supabase
          .from("product_batches")
          .select("expiration_date, quantity")
          .eq("product_id", productId)
          .eq("status", "active")
          .gt("quantity", 0)
          .lte("expiration_date", futureLimit.toISOString())
          .order("expiration_date")
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const daysUntil = differenceInDays(parseISO(data.expiration_date), today);
          
          let severity: "critical" | "warning" | "notice" = "notice";
          if (daysUntil <= EXPIRATION_THRESHOLDS.CRITICAL) {
            severity = "critical";
          } else if (daysUntil <= EXPIRATION_THRESHOLDS.WARNING) {
            severity = "warning";
          }

          setExpirationInfo({
            daysUntilExpiration: daysUntil,
            nearestExpirationDate: data.expiration_date,
            quantity: data.quantity,
            severity,
          });
        } else {
          setExpirationInfo(null);
        }
      } catch (error: any) {
        console.error("Error fetching expiration info:", error);
        setExpirationInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchExpirationInfo();
  }, [productId]);

  return { expirationInfo, loading };
}

export function getExpirationBadgeColor(severity: "critical" | "warning" | "notice") {
  switch (severity) {
    case "critical":
      return "destructive"; // Rojo
    case "warning":
      return "default"; // Naranja/Default
    case "notice":
      return "secondary"; // Amarillo
    default:
      return "secondary";
  }
}
