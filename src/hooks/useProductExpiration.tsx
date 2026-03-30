import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";
import { useEmpresaId } from "@/hooks/useEmpresaId";

// Default fallback — exported for backward compatibility
export const EXPIRATION_THRESHOLDS = {
  CRITICAL: 7,
  WARNING: 15,
  NOTICE: 30,
};

export interface ExpirationInfo {
  daysUntilExpiration: number;
  nearestExpirationDate: string;
  quantity: number;
  severity: "critical" | "warning" | "notice";
}

function useExpirationThresholds() {
  const empresaId = useEmpresaId();
  const [thresholds, setThresholds] = useState(EXPIRATION_THRESHOLDS);

  useEffect(() => {
    if (!empresaId) return;

    const fetch = async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("alert_days_critical, alert_days_warning, alert_days_notice")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (!error && data) {
        setThresholds({
          CRITICAL: data.alert_days_critical ?? EXPIRATION_THRESHOLDS.CRITICAL,
          WARNING: data.alert_days_warning ?? EXPIRATION_THRESHOLDS.WARNING,
          NOTICE: data.alert_days_notice ?? EXPIRATION_THRESHOLDS.NOTICE,
        });
      }
    };

    fetch();
  }, [empresaId]);

  return thresholds;
}

export function useProductExpiration(productId: string | null) {
  const [expirationInfo, setExpirationInfo] = useState<ExpirationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const thresholds = useExpirationThresholds();

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
        futureLimit.setDate(today.getDate() + thresholds.NOTICE);

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
          if (daysUntil <= thresholds.CRITICAL) {
            severity = "critical";
          } else if (daysUntil <= thresholds.WARNING) {
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
  }, [productId, thresholds]);

  return { expirationInfo, loading };
}

export function getExpirationBadgeColor(severity: "critical" | "warning" | "notice") {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    case "notice":
      return "secondary";
    default:
      return "secondary";
  }
}
