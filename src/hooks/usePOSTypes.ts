export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  stock: number;
  min_stock: number;
  stock_disabled?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  expirationInfo?: {
    daysUntilExpiration: number;
    nearestExpirationDate: string;
    quantity: number;
    severity: "critical" | "warning" | "notice";
  };
}

export interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  document: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  current_balance: number;
  status: string;
}

export interface CashSession {
  id: string;
  cash_register_id: string;
  cashier_id: string;
  opening_amount: number;
  opened_at: string;
  status: string;
  cash_registers: {
    name: string;
    location: string | null;
  };
}
