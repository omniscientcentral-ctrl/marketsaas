import {
  Home,
  ShoppingCart,
  Package,
  CreditCard,
  Receipt,
  Wallet,
  Settings,
  Building2,
  LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: string[];
  mobileLabel?: string; // Shorter label for mobile
}

export const navigationItems: NavigationItem[] = [
  {
    icon: Home,
    label: "Panel de control",
    path: "/dashboard",
    roles: ["admin"],
    mobileLabel: "Panel",
  },
  {
    icon: ShoppingCart,
    label: "Punto de Venta",
    path: "/pos",
    roles: ["cajero", "supervisor", "admin"],
    mobileLabel: "POS",
  },
  {
    icon: Package,
    label: "Productos",
    path: "/products",
    roles: ["repositor", "supervisor", "admin"],
    mobileLabel: "Stock",
  },
  {
    icon: CreditCard,
    label: "Clientes",
    path: "/customers",
    roles: ["supervisor", "admin"],
    mobileLabel: "Clientes",
  },
  {
    icon: Receipt,
    label: "Ventas",
    path: "/sales",
    roles: ["cajero", "supervisor", "admin"],
    mobileLabel: "Ventas",
  },
{
  icon: Wallet,
  label: "Gastos",
  path: "/admin/gastos",
  roles: ["cajero", "supervisor", "admin"],
  mobileLabel: "Gastos",
},
{
  icon: Settings,
  label: "Configuración",
  path: "/settings",
  roles: ["supervisor", "admin"],
  mobileLabel: "Config",
},
];

export const getNavigationForRoles = (userRoles: string[]): NavigationItem[] => {
  const normalizedRoles = userRoles.filter(Boolean).map((r) => r.toLowerCase());
  // super_admin has access to everything
  if (normalizedRoles.includes('super_admin')) {
    return navigationItems;
  }
  return navigationItems.filter((item) =>
    item.roles.some((role) => normalizedRoles.includes(role.toLowerCase()))
  );
};

export const getHomePathForRole = (role: string | null): string => {
  if (!role) return "/pos";
  const roleHome: Record<string, string> = {
    super_admin: "/dashboard",
    admin: "/dashboard",
    supervisor: "/pos",
    cajero: "/pos",
    repositor: "/products",
  };
  return roleHome[role.toLowerCase()] || "/pos";
};
