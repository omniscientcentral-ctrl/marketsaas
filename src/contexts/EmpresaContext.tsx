import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Empresa {
  id: string;
  nombre_empresa: string;
  estado: string;
  plan: string | null;
}

interface EmpresaContextType {
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  selectedEmpresa: Empresa | null;
  setSelectedEmpresaId: (id: string) => void;
  isSuperAdmin: boolean;
  loading: boolean;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresas: [],
  selectedEmpresaId: null,
  selectedEmpresa: null,
  setSelectedEmpresaId: () => {},
  isSuperAdmin: false,
  loading: true,
});

export const useEmpresaContext = () => useContext(EmpresaContext);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, activeRole } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = activeRole?.toLowerCase() === "super_admin";

  // Load empresas for super_admin
  useEffect(() => {
    if (!user || !isSuperAdmin) {
      setLoading(false);
      return;
    }

    const loadEmpresas = async () => {
      try {
        const { data, error } = await supabase
          .from("empresas")
          .select("id, nombre_empresa, estado, plan")
          .order("nombre_empresa");

        if (error) throw error;

        setEmpresas(data || []);

        // Restore from localStorage or default to first active empresa
        const savedId = localStorage.getItem("super_admin_empresa_context");
        const validSaved = data?.find((e) => e.id === savedId);
        
        if (validSaved) {
          setSelectedEmpresaIdState(validSaved.id);
        } else {
          const firstActive = data?.find((e) => e.estado === "activa");
          if (firstActive) {
            setSelectedEmpresaIdState(firstActive.id);
            localStorage.setItem("super_admin_empresa_context", firstActive.id);
          }
        }
      } catch (error) {
        console.error("Error loading empresas:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEmpresas();
  }, [user, isSuperAdmin]);

  // For non-super_admin, load their empresa_id from profile
  useEffect(() => {
    if (!user || isSuperAdmin) return;

    const loadUserEmpresa = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("id", user.id)
          .maybeSingle();

        if (data?.empresa_id) {
          setSelectedEmpresaIdState(data.empresa_id);
        }
      } catch (error) {
        console.error("Error loading user empresa:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUserEmpresa();
  }, [user, isSuperAdmin]);

  const setSelectedEmpresaId = (id: string) => {
    setSelectedEmpresaIdState(id);
    localStorage.setItem("super_admin_empresa_context", id);
  };

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId) || null;

  return (
    <EmpresaContext.Provider
      value={{
        empresas,
        selectedEmpresaId,
        selectedEmpresa,
        setSelectedEmpresaId,
        isSuperAdmin,
        loading,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
