import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ExpensesTab from "@/components/expenses/ExpensesTab";
import SuppliersTab from "@/components/expenses/SuppliersTab";

const ExpensesManagement = () => {
  const navigate = useNavigate();
  const { user, activeRole, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("gastos");

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    // Esperar a que activeRole esté definido antes de verificar permisos
    if (!activeRole) return;
    
    const allowedRoles = ['admin', 'supervisor', 'cajero'];
    if (!allowedRoles.includes(activeRole.toLowerCase())) {
      toast.error("No tenés permisos para acceder a esta página");
      navigate("/pos");
    }
  }, [user, activeRole, loading, navigate]);

  if (loading || !activeRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const allowedRolesCheck = ['admin', 'supervisor', 'cajero'];
  if (!user || !allowedRolesCheck.includes(activeRole.toLowerCase())) {
    return null;
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Administración de Gastos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los gastos y proveedores de la empresa
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="gastos">Gastos</TabsTrigger>
              <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
            </TabsList>

            <TabsContent value="gastos" className="mt-6">
              <ExpensesTab />
            </TabsContent>

            <TabsContent value="proveedores" className="mt-6">
              <SuppliersTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExpensesManagement;
