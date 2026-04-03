import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { EmpresaProvider } from "./contexts/EmpresaContext";
import { GlobalModeGuard } from "./components/GlobalModeGuard";
import UpdatePrompt from "@/components/UpdatePrompt";

const Auth               = lazy(() => import("./pages/Auth"));
const Dashboard          = lazy(() => import("./pages/Dashboard"));
const POS                = lazy(() => import("./pages/POS"));
const Products           = lazy(() => import("./pages/Products"));
const Customers          = lazy(() => import("./pages/Customers"));
const Settings           = lazy(() => import("./pages/Settings"));
const Sales              = lazy(() => import("./pages/Sales"));
const CashClosure        = lazy(() => import("./pages/CashClosure"));
const CashClosureHistory = lazy(() => import("./pages/CashClosureHistory"));
const ExpensesManagement = lazy(() => import("./pages/ExpensesManagement"));
const Empresas           = lazy(() => import("./pages/Empresas"));
const Planes             = lazy(() => import("./pages/Planes"));
const BackupRestore      = lazy(() => import("./pages/BackupRestore"));
const NotFound           = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,    // 2 min — data considered fresh globally
      gcTime: 1000 * 60 * 10,      // 10 min — keep cache in memory
      refetchOnWindowFocus: false,  // no refetch on tab switch
      retry: 1,                     // 1 retry instead of default 3
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Toaster />
      <Sonner />
      <UpdatePrompt />
      <BrowserRouter>
        <EmpresaProvider>
          <Suspense fallback={null}>
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
          </Suspense>
        </EmpresaProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
