import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, subDays, format, startOfWeek, startOfMonth } from "date-fns";

export type DateRange = "today" | "7d" | "30d" | "custom";

export interface DashboardFilters {
  dateRange: DateRange;
  customStartDate?: Date;
  customEndDate?: Date;
  cashRegisterId?: string;
}

export interface KPIData {
  salesToday: number;
  salesWeek: number;
  salesMonth: number;
  ticketsToday: number;
  ticketsWeek: number;
  ticketsMonth: number;
  averageTicket: number;
  totalDebt: number;
  paymentsReceived: number;
  cashPayments: number;
  cardPayments: number;
  creditPayments: number;
}

export interface CashRegisterStatus {
  id: string;
  name: string;
  location: string | null;
  isOpen: boolean;
  openByUser: string | null;
  openedAt: string | null;
  lastDifference: number | null;
}

export interface DailySalesData {
  date: string;
  total: number;
  tickets: number;
}

export interface HourlySalesData {
  hour: number;
  total: number;
  tickets: number;
}

export interface PaymentMethodData {
  method: string;
  total: number;
  count: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  quantity: number;
}

export interface DebtorCustomer {
  id: string;
  name: string;
  currentBalance: number;
  creditLimit: number;
  phone: string | null;
}

export interface ReturnItem {
  id: string;
  type: string;
  reason: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  createdAt: string;
}

export interface CriticalStockProduct {
  id: string;
  name: string;
  stock: number;
  stockDisabled: boolean;
  salesLast7Days: number;
}

export interface ExpiringProduct {
  id: string;
  productName: string;
  batchNumber: string | null;
  quantity: number;
  expirationDate: string;
  daysUntilExpiration: number;
}

export interface CreditEvolutionData {
  date: string;
  totalDebt: number;
  totalPayments: number;
}

export interface ExpirationSummary {
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
}

export const useDashboardData = (filters: DashboardFilters) => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegisterStatus[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySalesData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [debtors, setDebtors] = useState<DebtorCustomer[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockProduct[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [creditEvolution, setCreditEvolution] = useState<CreditEvolutionData[]>([]);
  const [expirationSummary, setExpirationSummary] = useState<ExpirationSummary | null>(null);

  const dateRanges = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const endToday = endOfDay(now);
    
    let startDate: Date;
    let endDate: Date = endToday;

    switch (filters.dateRange) {
      case "today":
        startDate = today;
        break;
      case "7d":
        startDate = subDays(today, 7);
        break;
      case "30d":
        startDate = subDays(today, 30);
        break;
      case "custom":
        startDate = filters.customStartDate || subDays(today, 30);
        endDate = filters.customEndDate ? endOfDay(filters.customEndDate) : endToday;
        break;
      default:
        startDate = today;
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      today: today.toISOString(),
      endToday: endToday.toISOString(),
      weekStart: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      monthStart: startOfMonth(now).toISOString(),
    };
  }, [filters.dateRange, filters.customStartDate, filters.customEndDate]);

  const loadKPIs = useCallback(async () => {
    try {
      // Sales today
      const { data: todaySales } = await supabase
        .from("sales")
        .select("total, payment_method, cash_amount, card_amount, credit_amount")
        .gte("created_at", dateRanges.today)
        .lte("created_at", dateRanges.endToday)
        .eq("status", "completed");

      // Sales this week
      const { data: weekSales } = await supabase
        .from("sales")
        .select("total")
        .gte("created_at", dateRanges.weekStart)
        .lte("created_at", dateRanges.endToday)
        .eq("status", "completed");

      // Sales this month
      const { data: monthSales } = await supabase
        .from("sales")
        .select("total")
        .gte("created_at", dateRanges.monthStart)
        .lte("created_at", dateRanges.endToday)
        .eq("status", "completed");

      // Total debt from customers
      const { data: debtData } = await supabase
        .from("customers")
        .select("current_balance")
        .gt("current_balance", 0);

      // Credit payments received in period
      const { data: paymentsData } = await supabase
        .from("credit_payments")
        .select("amount")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end);

      const salesToday = todaySales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const salesWeek = weekSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const salesMonth = monthSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const ticketsToday = todaySales?.length || 0;
      const ticketsWeek = weekSales?.length || 0;
      const ticketsMonth = monthSales?.length || 0;

      // Payment method totals from today's sales
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
  }, [dateRanges]);

  const loadCashRegisters = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("get_cash_registers_status");
      
      if (data) {
        const registers: CashRegisterStatus[] = data.map((r: any) => ({
          id: r.cash_register_id,
          name: r.name,
          location: r.location,
          isOpen: !!r.open_session_id,
          openByUser: r.open_by_user_name,
          openedAt: r.opened_at,
          lastDifference: null,
        }));
        setCashRegisters(registers);
      }
    } catch (error) {
      console.error("Error loading cash registers:", error);
    }
  }, []);

  const loadDailySales = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("sales")
        .select("created_at, total")
        .gte("created_at", subDays(new Date(), 30).toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (data) {
        const salesByDay = new Map<string, { total: number; tickets: number }>();
        
        // Initialize all 30 days
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

        const result: DailySalesData[] = Array.from(salesByDay.entries()).map(([date, data]) => ({
          date,
          total: data.total,
          tickets: data.tickets,
        }));

        setDailySales(result);
      }
    } catch (error) {
      console.error("Error loading daily sales:", error);
    }
  }, []);

  const loadHourlySales = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("sales")
        .select("created_at, total")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end)
        .eq("status", "completed");

      if (data) {
        const salesByHour = new Map<number, { total: number; tickets: number }>();
        
        // Initialize all hours
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

        const result: HourlySalesData[] = Array.from(salesByHour.entries()).map(([hour, data]) => ({
          hour,
          total: data.total,
          tickets: data.tickets,
        }));

        setHourlySales(result);
      }
    } catch (error) {
      console.error("Error loading hourly sales:", error);
    }
  }, [dateRanges]);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("sales")
        .select("payment_method, total")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end)
        .eq("status", "completed");

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

        const result: PaymentMethodData[] = Array.from(methodMap.entries()).map(([method, data]) => ({
          method: method === "efectivo" ? "Efectivo" : 
                  method === "tarjeta" ? "Tarjeta" : 
                  method === "credit" ? "Fiado" : 
                  method === "mixto" ? "Mixto" : method,
          total: data.total,
          count: data.count,
        }));

        setPaymentMethods(result);
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    }
  }, [dateRanges]);

  const loadTopProducts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("sale_items")
        .select("product_name, quantity, subtotal")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end);

      if (data) {
        const productMap = new Map<string, { revenue: number; quantity: number }>();

        data.forEach((item) => {
          const current = productMap.get(item.product_name) || { revenue: 0, quantity: 0 };
          productMap.set(item.product_name, {
            revenue: current.revenue + Number(item.subtotal),
            quantity: current.quantity + Number(item.quantity),
          });
        });

        const result: TopProduct[] = Array.from(productMap.entries())
          .map(([name, data]) => ({ name, revenue: data.revenue, quantity: data.quantity }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        setTopProducts(result);
      }
    } catch (error) {
      console.error("Error loading top products:", error);
    }
  }, [dateRanges]);

  const loadDebtors = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("customers")
        .select("id, name, current_balance, credit_limit, phone")
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false })
        .limit(10);

      if (data) {
        setDebtors(data.map((c) => ({
          id: c.id,
          name: c.name,
          currentBalance: Number(c.current_balance),
          creditLimit: Number(c.credit_limit),
          phone: c.phone,
        })));
      }
    } catch (error) {
      console.error("Error loading debtors:", error);
    }
  }, []);

  const loadReturns = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("returns")
        .select("id, return_type, reason, product_name, quantity, refund_amount, created_at")
        .gte("created_at", dateRanges.start)
        .lte("created_at", dateRanges.end)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setReturns(data.map((r) => ({
          id: r.id,
          type: r.return_type === "devolucion" ? "Devolución" : "Merma",
          reason: r.reason,
          productName: r.product_name,
          quantity: Number(r.quantity),
          refundAmount: Number(r.refund_amount) || 0,
          createdAt: r.created_at,
        })));
      }
    } catch (error) {
      console.error("Error loading returns:", error);
    }
  }, [dateRanges]);

  const loadCriticalStock = useCallback(async () => {
    try {
      // Products with stock disabled and high rotation
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock, stock_disabled")
        .eq("active", true);

      // Get sales from last 7 days to calculate rotation
      const weekAgo = subDays(new Date(), 7).toISOString();
      const { data: recentSales } = await supabase
        .from("sale_items")
        .select("product_id, quantity")
        .gte("created_at", weekAgo);

      if (products) {
        const salesByProduct = new Map<string, number>();
        recentSales?.forEach((sale) => {
          const current = salesByProduct.get(sale.product_id) || 0;
          salesByProduct.set(sale.product_id, current + Number(sale.quantity));
        });

        const criticalProducts: CriticalStockProduct[] = products
          .map((p) => ({
            id: p.id,
            name: p.name,
            stock: p.stock,
            stockDisabled: p.stock_disabled,
            salesLast7Days: salesByProduct.get(p.id) || 0,
          }))
          .filter((p) => p.stockDisabled && p.salesLast7Days > 0)
          .sort((a, b) => b.salesLast7Days - a.salesLast7Days)
          .slice(0, 15);

        setCriticalStock(criticalProducts);
      }
    } catch (error) {
      console.error("Error loading critical stock:", error);
    }
  }, []);

  const loadExpiringProducts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("products_expiring_soon")
        .select("*")
        .gt("quantity", 0)
        .order("days_until_expiry", { ascending: true })
        .limit(20);

      if (data) {
        setExpiringProducts(data.map((p) => ({
          id: p.batch_id || p.product_id || "",
          productName: p.product_name || "",
          batchNumber: p.batch_number,
          quantity: Number(p.quantity),
          expirationDate: p.expiration_date || "",
          daysUntilExpiration: p.days_until_expiry || 0,
        })));

        // Calculate expiration summary
        let summary: ExpirationSummary = {
          expiredCount: 0,
          criticalCount: 0,
          warningCount: 0,
          noticeCount: 0,
        };

        data.forEach((item) => {
          const days = item.days_until_expiry || 0;
          if (days <= 0) summary.expiredCount++;
          else if (days <= 7) summary.criticalCount++;
          else if (days <= 15) summary.warningCount++;
          else summary.noticeCount++;
        });

        setExpirationSummary(summary);
      }
    } catch (error) {
      console.error("Error loading expiring products:", error);
    }
  }, []);

  const loadCreditEvolution = useCallback(async () => {
    try {
      // Get credit creation (debt) by day
      const { data: credits } = await supabase
        .from("credits")
        .select("created_at, total_amount")
        .gte("created_at", subDays(new Date(), 30).toISOString());

      // Get payments by day
      const { data: payments } = await supabase
        .from("credit_payments")
        .select("created_at, amount")
        .gte("created_at", subDays(new Date(), 30).toISOString());

      const evolutionMap = new Map<string, { debt: number; payments: number }>();

      // Initialize all 30 days
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

      const result: CreditEvolutionData[] = Array.from(evolutionMap.entries()).map(([date, data]) => ({
        date,
        totalDebt: data.debt,
        totalPayments: data.payments,
      }));

      setCreditEvolution(result);
    } catch (error) {
      console.error("Error loading credit evolution:", error);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadKPIs(),
      loadCashRegisters(),
      loadDailySales(),
      loadHourlySales(),
      loadPaymentMethods(),
      loadTopProducts(),
      loadDebtors(),
      loadReturns(),
      loadCriticalStock(),
      loadExpiringProducts(),
      loadCreditEvolution(),
    ]);
    setLoading(false);
  }, [
    loadKPIs,
    loadCashRegisters,
    loadDailySales,
    loadHourlySales,
    loadPaymentMethods,
    loadTopProducts,
    loadDebtors,
    loadReturns,
    loadCriticalStock,
    loadExpiringProducts,
    loadCreditEvolution,
  ]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    loading,
    kpis,
    cashRegisters,
    dailySales,
    hourlySales,
    paymentMethods,
    topProducts,
    debtors,
    returns,
    criticalStock,
    expiringProducts,
    expirationSummary,
    creditEvolution,
    refresh: loadAllData,
  };
};
