import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

interface GlobalModeGuardProps {
  children: ReactNode;
}

/**
 * Wraps routes that require a specific empresa (write-capable pages).
 * When in Global Empresas mode, redirects to /dashboard with a warning.
 */
export function GlobalModeGuard({ children }: GlobalModeGuardProps) {
  const { isGlobalMode } = useEmpresaContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (isGlobalMode) {
      toast.error("Esta sección no está disponible en modo Global Empresas. Selecciona una empresa específica.");
      navigate("/dashboard", { replace: true });
    }
  }, [isGlobalMode, navigate]);

  if (isGlobalMode) return null;

  return <>{children}</>;
}
