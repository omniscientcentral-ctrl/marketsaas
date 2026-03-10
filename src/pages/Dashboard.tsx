import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import MainLayout from "@/components/layout/MainLayout";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { AdminNotificationCenter } from "@/components/AdminNotificationCenter";
import { KPICards } from "@/components/dashboard/KPICards";
import { CashRegistersStatus } from "@/components/dashboard/CashRegistersStatus";
import { SalesCharts } from "@/components/dashboard/SalesCharts";
import { ActionableLists } from "@/components/dashboard/ActionableLists";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ExpirationAlertBanner } from "@/components/dashboard/ExpirationAlertBanner";
import { useDashboardData, type DashboardFilters as Filters } from "@/hooks/useDashboardData";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import { useEmpresaContext } from "@/contexts/EmpresaContext";

const Dashboard = () => {
  const { user, loading: authLoading, activeRole } = useAuth();
  const { selectedEmpresaId, selectedEmpresa, isSuperAdmin } = useEmpresaContext();
  const navigate = useNavigate();
  const actionableListsRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<Filters>({
    dateRange: "today",
  });

  const {
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
    refresh,
  } = useDashboardData(filters, selectedEmpresaId);

  const handleViewExpirationDetails = () => {
    actionableListsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auth guard - only admin can access
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    
    if (!authLoading && user && activeRole) {
      const allowed = ["admin", "super_admin"];
      if (!allowed.includes(activeRole.toLowerCase())) {
        toast.error("Solo el administrador puede acceder al Panel de control");
        navigate("/pos");
      }
    }
  }, [user, authLoading, activeRole, navigate]);

  // Loading state
  if (authLoading || !activeRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Prevent rendering for non-admin
  if (!["admin", "super_admin"].includes(activeRole.toLowerCase())) {
    return null;
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Panel de control</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isSuperAdmin && selectedEmpresa
                ? `Empresa: ${selectedEmpresa.nombre_empresa}`
                : "Métricas y análisis en tiempo real"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <EmpresaSelector />
            </div>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
        {/* Filters */}
        <div className="px-4 pb-3">
          <DashboardFilters
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={refresh}
            loading={loading}
          />
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* Expiration Alert Banner */}
        <ExpirationAlertBanner
          summary={expirationSummary}
          loading={loading}
          onViewDetails={handleViewExpirationDetails}
        />

        {/* KPIs Section */}
        <section>
          <KPICards data={kpis} loading={loading} />
        </section>

        {/* Cash Registers Status */}
        <section>
          <CashRegistersStatus data={cashRegisters} loading={loading} />
        </section>

        {/* Charts Section */}
        <section>
          <SalesCharts
            dailySales={dailySales}
            hourlySales={hourlySales}
            paymentMethods={paymentMethods}
            topProducts={topProducts}
            creditEvolution={creditEvolution}
            loading={loading}
          />
        </section>

        {/* Actionable Lists */}
        <section ref={actionableListsRef}>
          <ActionableLists
            debtors={debtors}
            returns={returns}
            criticalStock={criticalStock}
            expiringProducts={expiringProducts}
            loading={loading}
          />
        </section>

        {/* Admin Notification Center */}
        <section>
          <AdminNotificationCenter />
        </section>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
