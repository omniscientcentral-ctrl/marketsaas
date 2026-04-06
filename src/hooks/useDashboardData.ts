import { useCallback } from "react";
import { useDashboardKPIs } from "./useDashboardKPIs";
import { useCashRegisters } from "./useCashRegisters";
import { useSalesCharts } from "./useSalesCharts";
import { useDashboardActionables } from "./useDashboardActionables";
import { useSalesByMonth } from "./useSalesByMonth";
import type { DashboardFilters } from "./dashboard/types";

// Re-export all types so existing imports from this path continue to work
export type { DateRange, DashboardFilters } from "./dashboard/types";
export type {
  KPIData,
  CashRegisterStatus,
  DailySalesData,
  HourlySalesData,
  PaymentMethodData,
  TopProduct,
  DebtorCustomer,
  ReturnItem,
  CriticalStockProduct,
  ExpiringProduct,
  CreditEvolutionData,
  ExpirationSummary,
  MonthlySales,
} from "./dashboard/types";

export { useSalesByMonth };

export const useDashboardData = (filters: DashboardFilters, empresaId?: string | null) => {
  const kpisResult        = useDashboardKPIs(filters, empresaId);
  const cashResult        = useCashRegisters(empresaId);
  const chartsResult      = useSalesCharts(filters, empresaId);
  const actionablesResult = useDashboardActionables(filters, empresaId);
  const monthlySalesResult = useSalesByMonth({ empresaId, familyId: filters.familyId });

  const loading =
    kpisResult.loading ||
    cashResult.loading ||
    chartsResult.loading ||
    actionablesResult.loading ||
    monthlySalesResult.loading;

  const refresh = useCallback(async () => {
    await Promise.all([
      kpisResult.refresh(),
      cashResult.refresh(),
      chartsResult.refresh(),
      actionablesResult.refresh(),
      monthlySalesResult.refresh(),
    ]);
  }, [kpisResult.refresh, cashResult.refresh, chartsResult.refresh, actionablesResult.refresh, monthlySalesResult.refresh]);

  return {
    loading,
    kpis:              kpisResult.kpis,
    cashRegisters:     cashResult.cashRegisters,
    dailySales:        chartsResult.dailySales,
    hourlySales:       chartsResult.hourlySales,
    paymentMethods:    chartsResult.paymentMethods,
    topProducts:       chartsResult.topProducts,
    creditEvolution:   chartsResult.creditEvolution,
    debtors:           actionablesResult.debtors,
    returns:           actionablesResult.returns,
    criticalStock:     actionablesResult.criticalStock,
    expiringProducts:  actionablesResult.expiringProducts,
    expirationSummary: actionablesResult.expirationSummary,
    monthlySales:      monthlySalesResult.data,
    refresh,
  };
};
