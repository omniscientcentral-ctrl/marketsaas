import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { GlobalModeGuard } from "./components/GlobalModeGuard";

import UpdatePrompt from "@/components/UpdatePrompt";
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
import Empresas from "./pages/Empresas";
import Planes from "./pages/Planes";
import BackupRestore from "./pages/BackupRestore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Toaster />
      <Sonner />
      <UpdatePrompt />
      <BrowserRouter>
        <EmpresaProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            {/* Read-only pages: accessible in global mode */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/cash-closure-history" element={<CashClosureHistory />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/planes" element={<Planes />} />
            {/* Write-capable pages: blocked in global mode */}
            <Route path="/pos" element={<GlobalModeGuard><POS /></GlobalModeGuard>} />
            <Route path="/products" element={<GlobalModeGuard><Products /></GlobalModeGuard>} />
            <Route path="/customers" element={<GlobalModeGuard><Customers /></GlobalModeGuard>} />
            <Route path="/settings" element={<GlobalModeGuard><Settings /></GlobalModeGuard>} />
            <Route path="/cash-closure" element={<GlobalModeGuard><CashClosure /></GlobalModeGuard>} />
            <Route path="/admin/gastos" element={<GlobalModeGuard><ExpensesManagement /></GlobalModeGuard>} />
            <Route path="/admin/respaldos" element={<GlobalModeGuard><BackupRestore /></GlobalModeGuard>} />
            {/* Redirects for old routes */}
            <Route path="/users" element={<Navigate to="/settings?tab=usuarios" replace />} />
            <Route path="/admin/cajas" element={<Navigate to="/settings?tab=cajas" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </EmpresaProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
