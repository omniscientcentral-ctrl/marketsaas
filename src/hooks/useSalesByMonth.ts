import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import type { MonthlySales } from "@/hooks/dashboard/types";

interface UseSalesByMonthOptions {
  empresaId?: string | null;
  familyId?: string | null;
}

export const useSalesByMonth = (options: UseSalesByMonthOptions = {}) => {
  const { empresaId, familyId } = options;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlySales[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [months, setMonths] = useState<string[]>([]);

  // Generate last 12 months
  useEffect(() => {
    const now = new Date();
    const monthList: string[] = [];
    for (let i = 11; i >= 0; i--) {
      monthList.push(format(subMonths(now, i), "yyyy-MM"));
    }
    setMonths(monthList);
  }, []);

  const fetchSalesByMonth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (months.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate proper start and end dates using endOfMonth
      const startDate = months[0] + "-01";
      const lastMonth = new Date(months[11] + "-01");
      const endDate = format(endOfMonth(lastMonth), "yyyy-MM-dd");

      // Use sales_with_families view if family filter is active
      const salesTable = familyId ? "sales_with_families" : "sales";

      // Build query
      let query = supabase
        .from(salesTable)
        .select("created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .eq("status", "completed");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (familyId) {
        query = query.eq("family_id", familyId);
      }

      const { data: sales, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (sales) {
        const counts = new Map<string, number>();

        sales.forEach((sale) => {
          const month = format(new Date(sale.created_at), "yyyy-MM");
          const current = counts.get(month) || 0;
          counts.set(month, current + 1);
        });

        const updatedMonths: MonthlySales[] = months.map((m) => ({
          month: m,
          count: counts.get(m) || 0,
        }));

        setData(updatedMonths);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching sales by month:", err);
    } finally {
      setLoading(false);
    }
  }, [empresaId, months]);

  const refresh = useCallback(async () => {
    await fetchSalesByMonth();
  }, [fetchSalesByMonth]);

  useEffect(() => {
    fetchSalesByMonth();
  }, [fetchSalesByMonth]);

  return {
    data,
    loading,
    error,
    refresh,
  };
};

export type { MonthlySales };
