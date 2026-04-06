import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CashSession } from "./usePOSTypes";

export function usePOSSession(userId: string | undefined) {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [stockDisabled, setStockDisabled] = useState(false);

  const checkCashRegisterSession = async () => {
    try {
      setSessionLoading(true);

      // Take the most recent open session if there are multiple
      const { data: sessions, error } = await supabase
        .from("cash_register")
        .select(
          `
          id,
          cash_register_id,
          cashier_id,
          opening_amount,
          opened_at,
          status,
          cash_registers(name, location)
        `,
        )
        .eq("cashier_id", userId)
        .eq("status", "open")
        .order("opened_at", { ascending: false });
      if (error) throw error;

      if (sessions && sessions.length > 0) {
        setCurrentSession(sessions[0] as any);
        setShowCashRegisterModal(false);
        if (sessions.length > 1) {
          toast.warning(
            `Tenés ${sessions.length} sesiones de caja abiertas. Se seleccionó la más reciente.`,
          );
        }
      } else {
        setShowCashRegisterModal(true);
      }
    } catch (error: any) {
      console.error("Error checking session:", error);
      toast.error("Error al verificar la sesión de caja");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSessionSelected = (session: CashSession) => {
    setCurrentSession(session);
    setShowCashRegisterModal(false);
    toast.success(`Trabajando en ${session.cash_registers.name}`);
  };

  const handleChangeCashRegister = () => {
    setShowCashRegisterModal(true);
  };

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("stock_disabled")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setStockDisabled(data.stock_disabled || false);
      }
    } catch (error: any) {
      console.error("Error loading company settings:", error);
    }
  };

  return {
    currentSession,
    sessionLoading,
    setSessionLoading,
    showCashRegisterModal,
    setShowCashRegisterModal,
    stockDisabled,
    checkCashRegisterSession,
    handleSessionSelected,
    handleChangeCashRegister,
    loadCompanySettings,
  };
}
