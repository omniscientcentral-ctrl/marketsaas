import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Sales from "./pages/Sales";
import CashClosure from "./pages/CashClosure";
import CashClosureHistory from "./pages/CashClosureHistory";
import ExpensesManagement from "./pages/ExpensesManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/cash-closure" element={<CashClosure />} />
          <Route path="/cash-closure-history" element={<CashClosureHistory />} />
          <Route path="/admin/gastos" element={<ExpensesManagement />} />
          {/* Redirects for old routes */}
          <Route path="/users" element={<Navigate to="/settings?tab=usuarios" replace />} />
          <Route path="/admin/cajas" element={<Navigate to="/settings?tab=cajas" replace />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
