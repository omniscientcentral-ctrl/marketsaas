import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildDateRanges } from "./dashboard/dateRanges";
import type { DashboardFilters, KPIData } from "./dashboard/types";

export const useDashboardKPIs = (filters: DashboardFilters, empresaId?: string | null) => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);

  const dateRanges = useMemo(() => buildDateRanges(filters), [
    filters.dateRange,
    filters.customStartDate,
    filters.customEndDate,
  ]);

  const loadKPIs = useCallback(async () => {
    try {
      const applyEmpresa = (query: any) =>
        empresaId ? query.eq("empresa_id", empresaId) : query;

      const { data: todaySales } = await applyEmpresa(
        supabase
          .from("sales")
          .select("total, payment_method, cash_amount, card_amount, credit_amount")
          .gte("created_at", dateRanges.today)
          .lte("created_at", dateRanges.endToday)
          .eq("status", "completed")
      );

      const { data: weekSales } = await applyEmpresa(
        supabase
          .from("sales")
          .select("total")
          .gte("created_at", dateRanges.weekStart)
          .lte("created_at", dateRanges.endToday)
          .eq("status", "completed")
      );

      const { data: monthSales } = await applyEmpresa(
        supabase
          .from("sales")
          .select("total")
          .gte("created_at", dateRanges.monthStart)
          .lte("created_at", dateRanges.endToday)
          .eq("status", "completed")
      );

      const { data: debtData } = await applyEmpresa(
        supabase
          .from("customers")
          .select("current_balance")
          .gt("current_balance", 0)
      );

      const { data: paymentsData } = await applyEmpresa(
        supabase
          .from("credit_payments")
          .select("amount")
          .gte("created_at", dateRanges.start)
          .lte("created_at", dateRanges.end)
      );

      const salesToday = todaySales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const salesWeek = weekSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const salesMonth = monthSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const ticketsToday = todaySales?.length || 0;
      const ticketsWeek = weekSales?.length || 0;
      const ticketsMonth = monthSales?.length || 0;

      let cashPayments = 0;
      let cardPayments = 0;
      let creditPayments = 0;

      todaySales?.forEach((sale) => {
        cashPayments += Number(sale.cash_amount) || 0;
        cardPayments += Number(sale.card_amount) || 0;
        creditPayments += Number(sale.credit_amount) || 0;
      });

      setKpis({
        salesToday,
        salesWeek,
        salesMonth,
        ticketsToday,
        ticketsWeek,
        ticketsMonth,
        averageTicket: ticketsToday > 0 ? salesToday / ticketsToday : 0,
        totalDebt: debtData?.reduce((sum, c) => sum + Number(c.current_balance), 0) || 0,
        paymentsReceived: paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        cashPayments,
        cardPayments,
        creditPayments,
      });
    } catch (error) {
      console.error("Error loading KPIs:", error);
    }
  }, [dateRanges, empresaId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadKPIs();
    setLoading(false);
  }, [loadKPIs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, kpis, refresh };
};
