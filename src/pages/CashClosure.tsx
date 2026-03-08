import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateA4PDF, generateTicketPDF } from "@/lib/pdfGenerator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CashClosureStep1 } from "@/components/cash-closure/CashClosureStep1";
import { CashClosureStep2 } from "@/components/cash-closure/CashClosureStep2";
import { CashClosureStep3 } from "@/components/cash-closure/CashClosureStep3";
import { CashClosureStep4 } from "@/components/cash-closure/CashClosureStep4";
import { CashClosureStep5 } from "@/components/cash-closure/CashClosureStep5";
import { CashOpenStep } from "@/components/cash-closure/CashOpenStep";
import { useNotifications } from "@/hooks/useNotifications";
import { getHomePathForRole } from "@/config/navigation";

export default function CashClosure() {
  const { user, activeRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [cashRegister, setCashRegister] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [cashDenominations, setCashDenominations] = useState<any>({
    "1000": 0, "500": 0, "200": 0, "100": 0, "50": 0,
    "20": 0, "10": 0, "5": 0, "2": 0, "1": 0
  });
  const [directCashTotal, setDirectCashTotal] = useState(0);
  const [countingMode, setCountingMode] = useState<"denominations" | "direct">("denominations");
  const [differenceReason, setDifferenceReason] = useState("");
  const [needsOpen, setNeedsOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<number>(0);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>("");
  const [printType, setPrintType] = useState<"a4" | "tickeadora" | "no_imprimir">("no_imprimir");
  const [approvalThreshold, setApprovalThreshold] = useState<number>(50);
  const { notifyCashClosureWithDifference, notifyCashOpening, notifyCashClosureZ } = useNotifications();

  useEffect(() => {
    // Esperar a que termine la carga de autenticación
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    // Esperar a que activeRole esté definido antes de verificar permisos
    if (!activeRole) return;

    // Guard: Solo admin, supervisor y cajero pueden acceder al cierre de caja
    const allowedRoles = ['admin', 'supervisor', 'cajero'];
    if (!allowedRoles.includes(activeRole)) {
      toast.error('No tenés permisos para el cierre de caja');
      navigate("/pos");
      return;
    }

    loadCashRegister();
    loadCompanySettings();
  }, [user, activeRole, authLoading, navigate]);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from("company_settings")
        .select("cash_closure_approval_threshold")
        .limit(1)
        .maybeSingle();
      
      if (data && (data as any).cash_closure_approval_threshold !== undefined) {
        setApprovalThreshold((data as any).cash_closure_approval_threshold);
      }
    } catch (error) {
      console.error("Error loading company settings:", error);
    }
  };

  const loadCashRegister = async () => {
    try {
      setLoading(true);
      
      // Buscar caja abierta del usuario (si hay varias, tomar la más reciente)
      const { data: register, error: registerError } = await supabase
        .from("cash_register")
        .select("*")
        .eq("cashier_id", user?.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError || !register) {
        setNeedsOpen(true);
        setLoading(false);
        return;
      }

      setCashRegister(register);

      // Obtener datos de ventas del turno
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (*)
        `)
        .eq("cashier_id", user?.id)
        .gte("created_at", register.opened_at);

      if (salesError) throw salesError;

      // Calcular totales
      const cashTotal = sales
        ?.filter(s => s.payment_method === "cash")
        .reduce((sum, s) => sum + Number(s.total), 0) || 0;

      const cardTotal = sales
        ?.filter(s => s.payment_method === "card")
        .reduce((sum, s) => sum + Number(s.card_amount || s.total), 0) || 0;

      const creditTotal = sales
        ?.filter(s => s.payment_method === "credit")
        .reduce((sum, s) => sum + Number(s.total), 0) || 0;

      const mixedCash = sales
        ?.filter(s => s.payment_method === "mixed")
        .reduce((sum, s) => sum + Number(s.cash_amount || 0), 0) || 0;

      const mixedCard = sales
        ?.filter(s => s.payment_method === "mixed")
        .reduce((sum, s) => sum + Number(s.card_amount || 0), 0) || 0;

      // Obtener ventas en espera
      const { data: pendingSales } = await supabase
        .from("pending_sales")
        .select("*")
        .eq("cashier_id", user?.id);

      // Obtener egresos
      const { data: expenses } = await supabase
        .from("cash_register_expenses")
        .select("*")
        .eq("cash_register_id", register.id);

      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      setSalesData({
        sales: sales || [],
        ticketCount: sales?.length || 0,
        cashTotal: cashTotal + mixedCash,
        cardTotal: cardTotal + mixedCard,
        creditTotal,
        totalExpenses,
        pendingSalesCount: pendingSales?.length || 0,
        expectedCash: register.opening_amount + cashTotal + mixedCash - totalExpenses
      });

    } catch (error: any) {
      console.error("Error loading cash register:", error);
      toast.error("Error al cargar datos de la caja");
      navigate(getHomePathForRole(activeRole));
    } finally {
      setLoading(false);
    }
  };

  const calculateCountedCash = () => {
    if (countingMode === "direct") {
      return directCashTotal;
    }
    return Object.entries(cashDenominations).reduce(
      (sum, [denom, count]) => sum + Number(denom) * Number(count),
      0
    );
  };

  const getDifference = () => {
    const counted = calculateCountedCash();
    const expected = salesData?.expectedCash || 0;
    return counted - expected;
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      const difference = getDifference();
      const requiresSupervisor = Math.abs(difference) > approvalThreshold;

      const closureData = {
        status: requiresSupervisor ? "pending_approval" : "closed",
        closed_at: new Date().toISOString(),
        closing_amount: calculateCountedCash(),
        expected_amount: salesData?.expectedCash,
        difference,
        cash_denominations: countingMode === "denominations" ? cashDenominations : null,
        card_total: salesData?.cardTotal,
        credit_sales_total: salesData?.creditTotal,
        cash_withdrawals: salesData?.totalExpenses,
        ticket_count: salesData?.ticketCount,
        difference_reason: differenceReason,
        requires_supervisor_approval: requiresSupervisor,
        closure_type: "X",
        print_type: printType
      };

      const { error } = await supabase
        .from("cash_register")
        .update(closureData)
        .eq("id", cashRegister.id);

      if (error) throw error;

      // Obtener perfil del cajero
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const cashierName = profile?.full_name || "Desconocido";
      const totalSales = (salesData?.cashTotal || 0) + (salesData?.cardTotal || 0) + (salesData?.creditTotal || 0);

      // Notificar SIEMPRE al administrador según el tipo de cierre
      if (Math.abs(difference) > 0.01) {
        // Cierre con diferencia
        await notifyCashClosureWithDifference({
          cashierName,
          difference,
          expectedAmount: salesData?.expectedCash,
          countedAmount: calculateCountedCash(),
          requiresApproval: requiresSupervisor,
        });
      } else if (closureData.closure_type === "Z") {
        // Cierre Z
        await notifyCashClosureZ({
          cashierName,
          totalSales,
          cashTotal: salesData?.cashTotal || 0,
          cardTotal: salesData?.cardTotal || 0,
        });
      } else {
        // Cierre X normal sin diferencia
        await notifyCashClosureZ({
          cashierName,
          totalSales,
          cashTotal: salesData?.cashTotal || 0,
          cardTotal: salesData?.cardTotal || 0,
        });
      }

      // Generar PDF según la opción seleccionada
      if (printType === "a4" || printType === "tickeadora") {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user?.id)
          .single();

        const { data: companyData } = await supabase
          .from("company_settings")
          .select("company_name, tax_id, address, city, phone, email, currency, receipt_footer, logo_url")
          .single();

        const pdfData = {
          ...cashRegister,
          ...closureData,
        };

        const pdfSalesData = {
          totalSales: (salesData?.cashTotal || 0) + (salesData?.cardTotal || 0) + (salesData?.creditTotal || 0),
          cashSales: salesData?.cashTotal || 0,
          cardSales: salesData?.cardTotal || 0,
          creditSales: salesData?.creditTotal || 0,
        };

        const cashierName = profileData?.full_name || user?.email || "Usuario";
        const company = companyData || undefined;

        if (printType === "a4") {
          await generateA4PDF(pdfData, pdfSalesData, cashierName, company);
        } else {
          await generateTicketPDF(pdfData, pdfSalesData, cashierName, company);
        }
      }

      toast.success(
        requiresSupervisor 
          ? "Cierre registrado. Requiere aprobación de supervisor" 
          : "Cierre de caja completado exitosamente"
      );
      
      navigate(getHomePathForRole(activeRole));
    } catch (error: any) {
      console.error("Error closing cash register:", error);
      toast.error("Error al cerrar la caja");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async () => {
    if (!selectedCashRegisterId) {
      toast.error("Seleccioná una caja");
      return;
    }

    try {
      setLoading(true);

      // Verificar que no exista sesión abierta en esa caja
      const { data: existingForRegister } = await supabase
        .from("cash_register")
        .select("id")
        .eq("cash_register_id", selectedCashRegisterId)
        .eq("status", "open")
        .maybeSingle();

      if (existingForRegister) {
        toast.error("Esta caja ya tiene una sesión abierta. Actualizando listado...");
        // Forzar recarga de estado para pasar a cierre si corresponde
        await loadCashRegister();
        return;
      }

      // Verificar que el usuario no tenga otra sesión abierta
      const { data: existingMine } = await supabase
        .from("cash_register")
        .select("id")
        .eq("cashier_id", user?.id)
        .eq("status", "open")
        .maybeSingle();

      if (existingMine) {
        toast.error("Ya tenés una sesión abierta. Cerrala antes de abrir otra.");
        return;
      }

      const { data, error } = await supabase
        .from("cash_register")
        .insert({
          cashier_id: user?.id,
          cash_register_id: selectedCashRegisterId,
          opening_amount: openingAmount,
          status: "open",
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setCashRegister(data);
      setNeedsOpen(false);

      // Obtener nombre de la caja y del cajero
      const { data: registerData } = await supabase
        .from("cash_registers")
        .select("name")
        .eq("id", selectedCashRegisterId)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      // Notificar apertura
      await notifyCashOpening({
        cashierName: profile?.full_name || "Desconocido",
        openingAmount,
        cashRegisterName: registerData?.name || "Caja",
      });

      await loadCashRegister();
      toast.success("Caja abierta correctamente");
    } catch (e: any) {
      console.error("open cash error", e);
      if (e.code === "23505" || e.message?.includes("idx_unique_open_session_per_register")) {
        toast.error("Esta caja fue ocupada por otro usuario. Intentá nuevamente.");
      } else {
        toast.error(e?.message || "No se pudo abrir la caja");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading || !activeRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(getHomePathForRole(activeRole))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{needsOpen ? "Apertura de Caja" : "Cierre de Caja"}</h1>
          <p className="text-muted-foreground">{needsOpen ? "Abrir caja para iniciar el turno" : "Arqueo guiado paso a paso"}</p>
        </div>
      </div>

      {!needsOpen && (
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step <= currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 5 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Inicio</span>
            <span>Efectivo</span>
            <span>Comparación</span>
            <span>Diferencia</span>
            <span>Confirmar</span>
          </div>
        </div>
      )}

      <Card className="p-6">
        {needsOpen ? (
          <CashOpenStep
            openingAmount={openingAmount}
            onChange={setOpeningAmount}
            onOpen={handleOpenCash}
            selectedCashRegisterId={selectedCashRegisterId}
            onCashRegisterChange={setSelectedCashRegisterId}
          />
        ) : (
          <>
            {currentStep === 1 && (
              <CashClosureStep1
                cashRegister={cashRegister}
                salesData={salesData}
                onNext={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 2 && (
              <CashClosureStep2
                denominations={cashDenominations}
                onChange={setCashDenominations}
                onNext={() => setCurrentStep(3)}
                onBack={() => setCurrentStep(1)}
                directTotal={directCashTotal}
                onDirectTotalChange={setDirectCashTotal}
                countingMode={countingMode}
                onCountingModeChange={setCountingMode}
              />
            )}
            {currentStep === 3 && (
              <CashClosureStep3
                expectedCash={salesData?.expectedCash}
                countedCash={calculateCountedCash()}
                cardTotal={salesData?.cardTotal}
                creditTotal={salesData?.creditTotal}
                expenses={salesData?.totalExpenses}
                difference={getDifference()}
                approvalThreshold={approvalThreshold}
                onNext={() => setCurrentStep(4)}
                onBack={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 4 && (
              <CashClosureStep4
                difference={getDifference()}
                approvalThreshold={approvalThreshold}
                reason={differenceReason}
                onChange={setDifferenceReason}
                onNext={() => setCurrentStep(5)}
                onBack={() => setCurrentStep(3)}
              />
            )}
            {currentStep === 5 && (
              <CashClosureStep5
                cashRegister={cashRegister}
                salesData={salesData}
                countedCash={calculateCountedCash()}
                difference={getDifference()}
                reason={differenceReason}
                denominations={cashDenominations}
                approvalThreshold={approvalThreshold}
                printType={printType}
                onPrintTypeChange={setPrintType}
                onConfirm={handleComplete}
                onBack={() => setCurrentStep(4)}
                loading={loading}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
