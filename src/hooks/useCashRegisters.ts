import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CashRegisterStatus } from "./dashboard/types";

export const useCashRegisters = (empresaId?: string | null) => {
  const [loading, setLoading] = useState(true);
  const [cashRegisters, setCashRegisters] = useState<CashRegisterStatus[]>([]);

  const loadCashRegisters = useCallback(async () => {
    try {
      if (empresaId) {
        const { data: registers } = await supabase
          .from("cash_registers")
          .select("id, name, location, cash_register_sessions!left(opened_at, cashier_id, status)")
          .eq("empresa_id", empresaId)
          .eq("is_active", true)
          .eq("cash_register_sessions.status", "open");

        if (registers) {
          const result: CashRegisterStatus[] = registers.map((r) => {
            const sessions = (r.cash_register_sessions as Array<{ opened_at: string | null; cashier_id: string; status: string }> | null) ?? [];
            const session = sessions[0] ?? null;
            return {
              id: r.id,
              name: r.name,
              location: r.location,
              isOpen: sessions.length > 0,
              openByUser: null,
              openedAt: session?.opened_at ?? null,
              lastDifference: null,
            };
          });
          setCashRegisters(result);
        }
      } else {
        const { data } = await supabase.rpc("get_cash_registers_status");
        if (data) {
          const registers: CashRegisterStatus[] = data.map((r: any) => ({
            id: r.cash_register_id,
            name: r.name,
            location: r.location,
            isOpen: !!r.open_session_id,
            openByUser: r.open_by_user_name,
            openedAt: r.opened_at,
            lastDifference: null,
          }));
          setCashRegisters(registers);
        }
      }
    } catch (error) {
      console.error("Error loading cash registers:", error);
    }
  }, [empresaId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadCashRegisters();
    setLoading(false);
  }, [loadCashRegisters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, cashRegisters, refresh };
};
