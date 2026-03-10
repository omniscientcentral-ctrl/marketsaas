import { useEmpresaContext } from "@/contexts/EmpresaContext";

/**
 * Returns the active empresa_id to use in queries.
 * - For super_admin: returns the selected empresa from the global selector.
 * - For normal users: returns their profile's empresa_id (set by RLS).
 * 
 * Usage in queries:
 * ```ts
 * const empresaId = useEmpresaId();
 * // Add to query: .eq('empresa_id', empresaId)
 * ```
 */
export const useEmpresaId = () => {
  const { selectedEmpresaId } = useEmpresaContext();
  return selectedEmpresaId;
};
