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
  reason: string | null;
  productName: string;
  quantity: number;
  refundAmount: number;
  createdAt: string | null;
}

export interface CriticalStockProduct {
  id: string;
  name: string;
  stock: number;
  stockDisabled: boolean | null;
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
