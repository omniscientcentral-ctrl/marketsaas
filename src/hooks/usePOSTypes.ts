export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  stock: number;
  min_stock: number;
  stock_disabled?: boolean;
  cost: number;
  iva_tipo?: "incluido" | "minimo" | "normal";
  utilidad_porcentaje?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  iva_tipo: "incluido" | "minimo" | "normal";
  iva_porcentaje: number;
  utilidad_porcentaje: number;
  costo_con_iva: number;
  precio_final: number;
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
