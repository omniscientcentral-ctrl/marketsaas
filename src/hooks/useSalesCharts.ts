import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";
import { buildDateRanges } from "./dashboard/dateRanges";
import type {
  DashboardFilters,
  DailySalesData,
  HourlySalesData,
  PaymentMethodData,
  TopProduct,
  CreditEvolutionData,
} from "./dashboard/types";

export const useSalesCharts = (filters: DashboardFilters, empresaId?: string | null) => {
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySalesData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [creditEvolution, setCreditEvolution] = useState<CreditEvolutionData[]>([]);

  const dateRanges = useMemo(() => buildDateRanges(filters), [
    filters.dateRange,
    filters.customStartDate,
    filters.customEndDate,
  ]);

  const salesTable = useMemo(
    () => (filters.familyId ? "sales_with_families" : "sales"),
    [filters.familyId]
  );

  const applyFilters = useCallback(
    (query: any) => {
      let q = empresaId ? query.eq("empresa_id", empresaId) : query;
      if (filters.familyId) {
        q = q.eq("family_id", filters.familyId);
      }
      return q;
    },
    [empresaId, filters.familyId]
  );

  const loadDailySales = useCallback(async () => {
    try {
      const { data } = await applyFilters(
        supabase
          .from(salesTable)
          .select("created_at, total")
          .gte("created_at", subDays(new Date(), 30).toISOString())
          .eq("status", "completed")
          .order("created_at", { ascending: true })
      );

      if (data) {
        const salesByDay = new Map<string, { total: number; tickets: number }>();

        for (let i = 29; i >= 0; i--) {
          const date = format(subDays(new Date(), i), "yyyy-MM-dd");
          salesByDay.set(date, { total: 0, tickets: 0 });
        }

        data.forEach((sale) => {
          const date = format(new Date(sale.created_at), "yyyy-MM-dd");
          const current = salesByDay.get(date) || { total: 0, tickets: 0 };
          salesByDay.set(date, {
            total: current.total + Number(sale.total),
            tickets: current.tickets + 1,
          });
        });

        setDailySales(
          Array.from(salesByDay.entries()).map(([date, d]) => ({
            date,
            total: d.total,
            tickets: d.tickets,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading daily sales:", error);
    }
  }, [applyFilters, salesTable, dateRanges]);

  const loadHourlySales = useCallback(async () => {
    try {
      const { data } = await applyFilters(
        supabase
          .from(salesTable)
          .select("created_at, total")
          .gte("created_at", dateRanges.start)
          .lte("created_at", dateRanges.end)
          .eq("status", "completed")
      );

      if (data) {
        const salesByHour = new Map<number, { total: number; tickets: number }>();

        for (let i = 0; i < 24; i++) {
          salesByHour.set(i, { total: 0, tickets: 0 });
        }

        data.forEach((sale) => {
          const hour = new Date(sale.created_at).getHours();
          const current = salesByHour.get(hour) || { total: 0, tickets: 0 };
          salesByHour.set(hour, {
            total: current.total + Number(sale.total),
            tickets: current.tickets + 1,
          });
        });

        setHourlySales(
          Array.from(salesByHour.entries()).map(([hour, d]) => ({
            hour,
            total: d.total,
            tickets: d.tickets,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading hourly sales:", error);
    }
  }, [dateRanges, applyFilters, salesTable]);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data } = await applyFilters(
        supabase
          .from(salesTable)
          .select("payment_method, total")
          .gte("created_at", dateRanges.start)
          .lte("created_at", dateRanges.end)
          .eq("status", "completed")
      );

      if (data) {
        const methodMap = new Map<string, { total: number; count: number }>();

        data.forEach((sale) => {
          const method = sale.payment_method || "efectivo";
          const current = methodMap.get(method) || { total: 0, count: 0 };
          methodMap.set(method, {
            total: current.total + Number(sale.total),
            count: current.count + 1,
          });
        });

        setPaymentMethods(
          Array.from(methodMap.entries()).map(([method, d]) => ({
            method:
              method === "efectivo" ? "Efectivo" :
              method === "tarjeta" ? "Tarjeta" :
              method === "credit" ? "Fiado" :
              method === "mixto" ? "Mixto" : method,
            total: d.total,
            count: d.count,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  }, [dateRanges, applyFilters, salesTable]);

  const loadTopProducts = useCallback(async () => {
    try {
      // If family filter is active, we need to get product IDs first
      let query = supabase
        .from("sale_items")
        .select("product_name, quantity, subtotal")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end);

      if (filters.familyId) {
        // Get product IDs belonging to this family
        const { data: products } = await supabase
          .from("products")
          .select("id")
          .eq("family_id", filters.familyId)
          .eq("active", true);

        const productIds = products?.map((p) => p.id) || [];
        if (productIds.length === 0) {
          setTopProducts([]);
          return;
        }

        query = query.in("product_id", productIds);
      }

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data } = await query;

      if (data) {
        const productMap = new Map<string, { revenue: number; quantity: number }>();

        data.forEach((item) => {
          const current = productMap.get(item.product_name) || { revenue: 0, quantity: 0 };
          productMap.set(item.product_name, {
            revenue: current.revenue + Number(item.subtotal),
            quantity: current.quantity + Number(item.quantity),
          });
        });

        setTopProducts(
          Array.from(productMap.entries())
            .map(([name, d]) => ({ name, revenue: d.revenue, quantity: d.quantity }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
        );
      }
    } catch (error) {
      console.error("Error loading top products:", error);
    }
  }, [dateRanges, filters.familyId, empresaId]);

  const loadCreditEvolution = useCallback(async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      let creditsQuery = supabase
        .from("credits")
        .select("created_at, total_amount, sale_id")
        .gte("created_at", thirtyDaysAgo);

      let paymentsQuery = supabase
        .from("credit_payments")
        .select("created_at, amount")
        .gte("created_at", thirtyDaysAgo);

      if (filters.familyId) {
        // Get sale IDs for this family to filter credits
        const { data: familySales } = await supabase
          .from("sales_with_families")
          .select("sale_id")
          .eq("family_id", filters.familyId)
          .gte("created_at", thirtyDaysAgo);

        const saleIds = familySales?.map((s) => s.sale_id) || [];
        if (saleIds.length === 0) {
          setCreditEvolution([]);
          return;
        }

        creditsQuery = creditsQuery.in("sale_id", saleIds);
        // credit_payments may not have sale_id directly, may need different logic
        // For now, skip filter on payments if they don't have sale_id relation
      }

      if (empresaId) {
        creditsQuery = creditsQuery.eq("empresa_id", empresaId);
        // payments might not have empresa_id; skip
      }

      const { data: credits } = await creditsQuery;
      const { data: payments } = await paymentsQuery;

      const evolutionMap = new Map<string, { debt: number; payments: number }>();

      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        evolutionMap.set(date, { debt: 0, payments: 0 });
      }

      credits?.forEach((c) => {
        const date = format(new Date(c.created_at), "yyyy-MM-dd");
        const current = evolutionMap.get(date) || { debt: 0, payments: 0 };
        evolutionMap.set(date, { ...current, debt: current.debt + Number(c.total_amount) });
      });

      payments?.forEach((p) => {
        const date = format(new Date(p.created_at), "yyyy-MM-dd");
        const current = evolutionMap.get(date) || { debt: 0, payments: 0 };
        evolutionMap.set(date, { ...current, payments: current.payments + Number(p.amount) });
      });

      setCreditEvolution(
        Array.from(evolutionMap.entries()).map(([date, d]) => ({
          date,
          totalDebt: d.debt,
          totalPayments: d.payments,
        }))
      );
    } catch (error) {
      console.error("Error loading credit evolution:", error);
    }
  }, [filters, empresaId, dateRanges]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadDailySales(),
      loadHourlySales(),
      loadPaymentMethods(),
      loadTopProducts(),
      loadCreditEvolution(),
    ]);
    setLoading(false);
  }, [loadDailySales, loadHourlySales, loadPaymentMethods, loadTopProducts, loadCreditEvolution]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, dailySales, hourlySales, paymentMethods, topProducts, creditEvolution, refresh };
};
