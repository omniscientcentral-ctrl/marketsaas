import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

/**
 * Hook to check global mode and block write operations.
 * Usage:
 * ```ts
 * const { isGlobalMode, blockIfGlobal } = useGlobalMode();
 * 
 * const handleSave = () => {
 *   if (blockIfGlobal()) return; // Shows toast and returns true if in global mode
 *   // proceed with save...
 * };
 * ```
 */
export const useGlobalMode = () => {
  const { isGlobalMode } = useEmpresaContext();

  const blockIfGlobal = (customMessage?: string): boolean => {
    if (isGlobalMode) {
      toast.error(
        customMessage || "Operación no permitida en modo Global Empresas. Selecciona una empresa específica para realizar esta acción."
      );
      return true;
    }
    return false;
  };

  return { isGlobalMode, blockIfGlobal };
};
