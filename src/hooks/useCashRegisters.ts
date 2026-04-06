import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CashRegisterStatus } from "./dashboard/types";

export const useCashRegisters = (empresaId?: string | null) => {
  const [loading, setLoading] = useState(true);
  const [cashRegisters, setCashRegisters] = useState<CashRegisterStatus[]>([]);

  const loadCashRegisters = useCallback(async () => {
    try {
      // Primero, obtener las cajas activas
      let cashRegistersQuery = supabase
        .from("cash_registers")
        .select("id, name, location")
        .eq("is_active", true);

      if (empresaId) {
        cashRegistersQuery = cashRegistersQuery.eq("empresa_id", empresaId);
      }

      const { data: registers, error: registersError } = await cashRegistersQuery;

      if (registersError) {
        throw registersError;
      }

      if (!registers || registers.length === 0) {
        setCashRegisters([]);
        return;
      }

      // Obtener sesiones abiertas para todas las cajas
      const registerIds = registers.map((r) => r.id);
      const { data: sessions } = await supabase
        .from("cash_register_sessions")
        .select("cash_register_id, opened_at, cashier_id")
        .in("cash_register_id", registerIds)
        .eq("status", "open");

      // Crear mapa de sesiones por caja
      const sessionsByRegister = new Map<string, { opened_at: string; cashier_id: string }>();
      sessions?.forEach((session) => {
        sessionsByRegister.set(session.cash_register_id, {
          opened_at: session.opened_at,
          cashier_id: session.cashier_id,
        });
      });

      // Combinar datos de cajas con sesiones
      const result: CashRegisterStatus[] = registers.map((r) => {
        const session = sessionsByRegister.get(r.id) || null;
        return {
          id: r.id,
          name: r.name,
          location: r.location,
          isOpen: session !== null,
          openByUser: null, // Necesitaríamos join con users para obtener el nombre
          openedAt: session?.opened_at || null,
          lastDifference: null,
        };
      });

      setCashRegisters(result);
    } catch (error) {
      console.error("Error loading cash registers:", error);
      setCashRegisters([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const refresh = useCallback(async () => {
    await loadCashRegisters();
  }, [loadCashRegisters]);

  useEffect(() => {
    loadCashRegisters();
  }, [loadCashRegisters]);

  return { loading, cashRegisters, refresh };
};
