import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { buildDateRanges } from "./dashboard/dateRanges";
import type {
  DashboardFilters,
  DebtorCustomer,
  ReturnItem,
  CriticalStockProduct,
  ExpiringProduct,
  ExpirationSummary,
} from "./dashboard/types";

export const useDashboardActionables = (filters: DashboardFilters, empresaId?: string | null) => {
  const [loading, setLoading] = useState(true);
  const [debtors, setDebtors] = useState<DebtorCustomer[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockProduct[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [expirationSummary, setExpirationSummary] = useState<ExpirationSummary | null>(null);

  const dateRanges = useMemo(() => buildDateRanges(filters), [
    filters.dateRange,
    filters.customStartDate,
    filters.customEndDate,
  ]);

  const applyEmpresa = useCallback(
    (query: any) => (empresaId ? query.eq("empresa_id", empresaId) : query),
    [empresaId]
  );

  const loadDebtors = useCallback(async () => {
    try {
      const { data } = await applyEmpresa(
        supabase
          .from("customers")
          .select("id, name, current_balance, credit_limit, phone")
          .gt("current_balance", 0)
          .order("current_balance", { ascending: false })
          .limit(10)
      );

      if (data) {
        setDebtors(
          data.map((c) => ({
            id: c.id,
            name: c.name,
            currentBalance: Number(c.current_balance),
            creditLimit: Number(c.credit_limit),
            phone: c.phone,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading debtors:", error);
    }
  }, [applyEmpresa]);

  const loadReturns = useCallback(async () => {
    try {
      const { data } = await applyEmpresa(
        supabase
          .from("returns")
          .select("id, return_type, reason, product_name, quantity, refund_amount, created_at")
          .gte("created_at", dateRanges.start)
          .lte("created_at", dateRanges.end)
          .order("created_at", { ascending: false })
          .limit(20)
      );

      if (data) {
        setReturns(
          data.map((r) => ({
            id: r.id,
            type: r.return_type === "devolucion" ? "Devolución" : "Merma",
            reason: r.reason,
            productName: r.product_name,
            quantity: Number(r.quantity),
            refundAmount: Number(r.refund_amount) || 0,
            createdAt: r.created_at,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading returns:", error);
    }
  }, [dateRanges, applyEmpresa]);

  const loadCriticalStock = useCallback(async () => {
    try {
      const { data: products } = await applyEmpresa(
        supabase
          .from("products")
          .select("id, name, stock, stock_disabled")
          .eq("active", true)
      );

      const { data: recentSales } = await applyEmpresa(
        supabase
          .from("sale_items")
          .select("product_id, quantity")
          .gte("created_at", subDays(new Date(), 7).toISOString())
      );

      if (products) {
        const salesByProduct = new Map<string, number>();
        recentSales?.forEach((sale) => {
          const current = salesByProduct.get(sale.product_id) || 0;
          salesByProduct.set(sale.product_id, current + Number(sale.quantity));
        });

        setCriticalStock(
          products
            .map((p) => ({
              id: p.id,
              name: p.name,
              stock: p.stock,
              stockDisabled: p.stock_disabled,
              salesLast7Days: salesByProduct.get(p.id) || 0,
            }))
            .filter((p) => p.stockDisabled && p.salesLast7Days > 0)
            .sort((a, b) => b.salesLast7Days - a.salesLast7Days)
            .slice(0, 15)
        );
      }
    } catch (error) {
      console.error("Error loading critical stock:", error);
    }
  }, [applyEmpresa]);

  const loadExpiringProducts = useCallback(async () => {
    try {
      const { data } = await applyEmpresa(
        supabase
          .from("products_expiring_soon")
          .select("batch_id, product_id, product_name, batch_number, quantity, expiration_date, days_until_expiry")
          .gt("quantity", 0)
          .order("days_until_expiry", { ascending: true })
          .limit(20)
      );

      if (data) {
        setExpiringProducts(
          data.map((p) => ({
            id: p.batch_id || p.product_id || "",
            productName: p.product_name || "",
            batchNumber: p.batch_number,
            quantity: Number(p.quantity),
            expirationDate: p.expiration_date || "",
            daysUntilExpiration: p.days_until_expiry || 0,
          }))
        );

        const summary: ExpirationSummary = {
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
  }, [applyEmpresa]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadDebtors(),
      loadReturns(),
      loadCriticalStock(),
      loadExpiringProducts(),
    ]);
    setLoading(false);
  }, [loadDebtors, loadReturns, loadCriticalStock, loadExpiringProducts]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    debtors,
    returns,
    criticalStock,
    expiringProducts,
    expirationSummary,
    refresh,
  };
};
