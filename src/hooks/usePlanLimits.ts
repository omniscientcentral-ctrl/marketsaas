import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/hooks/useAuth";

export const usePlanLimits = () => {
  const empresaId = useEmpresaId();
  const { userRoles: roles } = useAuth();
  const isSuperAdmin = roles?.includes("super_admin");

  const { data: planData, isLoading: loadingPlan } = useQuery({
    queryKey: ["plan-limits", empresaId],
    enabled: !!empresaId && !isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("planes(max_usuarios, max_productos, max_cajas)")
        .eq("id", empresaId!)
        .single();
      if (error) throw error;
      return (data as any)?.planes ?? null;
    },
    staleTime: 1000 * 60 * 15,
  });

  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["plan-counts", empresaId],
    enabled: !!empresaId && !isSuperAdmin,
    queryFn: async () => {
      const [usersRes, productsRes, cajasRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!).eq("is_active", true),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!).eq("active", true),
        supabase.from("cash_registers").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!).eq("is_active", true),
      ]);
      return {
        usuarios: usersRes.count ?? 0,
        productos: productsRes.count ?? 0,
        cajas: cajasRes.count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 3,
  });

  if (isSuperAdmin) {
    return {
      canAddUser: true,
      canAddProduct: true,
      canAddCaja: true,
      counts: { usuarios: 0, productos: 0, cajas: 0 },
      limits: { max_usuarios: null, max_productos: null, max_cajas: null },
      isLoading: false,
    };
  }

  const limits = {
    max_usuarios: planData?.max_usuarios ?? null,
    max_productos: planData?.max_productos ?? null,
    max_cajas: planData?.max_cajas ?? null,
  };

  const currentCounts = counts ?? { usuarios: 0, productos: 0, cajas: 0 };

  const canAdd = (current: number, max: number | null) =>
    max === null || max === 0 || current < max;

  return {
    canAddUser: canAdd(currentCounts.usuarios, limits.max_usuarios),
    canAddProduct: canAdd(currentCounts.productos, limits.max_productos),
    canAddCaja: canAdd(currentCounts.cajas, limits.max_cajas),
    counts: currentCounts,
    limits,
    isLoading: loadingPlan || loadingCounts,
  };
};
