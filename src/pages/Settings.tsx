import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "@/components/settings/CompanyTab";
import UsersTab from "@/components/settings/UsersTab";
import CashRegistersTab from "@/components/settings/CashRegistersTab";
import SystemTab from "@/components/settings/SystemTab";

const Settings = () => {
  const { user, loading, activeRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Determinar tab inicial desde URL o según rol
  const getInitialTab = () => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["empresa", "usuarios", "cajas", "sistema"].includes(tabParam)) {
      return tabParam;
    }
    // Admin ve empresa por defecto, supervisor ve usuarios
    return activeRole === "admin" ? "empresa" : "usuarios";
  };

  const SUPPORT_EMAIL = "soporte@soporte.com";
  const isSupportUser = user?.email === SUPPORT_EMAIL;

  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && activeRole) {
      const allowedRoles = ["admin", "supervisor", "super_admin"];
      if (!allowedRoles.includes(activeRole.toLowerCase())) {
        navigate("/dashboard");
      }
    }
  }, [user, loading, activeRole, navigate]);

  // Sincronizar tab con URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["empresa", "usuarios", "cajas", "sistema"].includes(tabParam)) {
      if ((tabParam === "cajas" || tabParam === "sistema") && !isSupportUser) {
        const defaultTab = activeRole === "admin" ? "empresa" : "usuarios";
        setActiveTab(defaultTab);
        setSearchParams({ tab: defaultTab });
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [searchParams, isSupportUser, activeRole]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  // Definir tabs disponibles según rol
  const availableTabs = [
    { id: "empresa", label: "Empresa", roles: ["admin"] },
    { id: "usuarios", label: "Usuarios", roles: ["admin", "supervisor"] },
    ...(isSupportUser ? [
      { id: "cajas", label: "Cajas", roles: ["admin", "supervisor"] },
      { id: "sistema", label: "Sistema", roles: ["admin"] },
    ] : []),
  ].filter(tab => activeRole && tab.roles.includes(activeRole.toLowerCase()));

  if (loading || !activeRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">Configuración</h1>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6">
            {availableTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeRole === "admin" && (
            <TabsContent value="empresa">
              <CompanyTab />
            </TabsContent>
          )}

          <TabsContent value="usuarios">
            <UsersTab />
          </TabsContent>

          {isSupportUser && (
            <TabsContent value="cajas">
              <CashRegistersTab />
            </TabsContent>
          )}

          {isSupportUser && activeRole === "admin" && (
            <TabsContent value="sistema">
              <SystemTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;
