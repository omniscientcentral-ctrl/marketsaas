import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductFamily {
  id: string;
  empresa_id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseProductFamiliesReturn {
  families: ProductFamily[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createFamily: (data: { name: string; description?: string }) => Promise<ProductFamily | null>;
  updateFamily: (id: string, data: { name?: string; description?: string; active?: boolean }) => Promise<boolean>;
  deleteFamily: (id: string) => Promise<boolean>;
}

export const useProductFamilies = (empresaId?: string | null): UseProductFamiliesReturn => {
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadFamilies = useCallback(async () => {
    try {
      setError(null);
      if (!empresaId) {
        setFamilies([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("product_families")
        .select("id, empresa_id, name, description, active, created_at, updated_at")
        .eq("empresa_id", empresaId)
        .eq("active", true)
        .order("name", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setFamilies((data || []) as ProductFamily[]);
    } catch (err) {
      setError(err as Error);
      console.error("Error loading product families:", err);
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFamilies();
  }, [loadFamilies]);

  const createFamily = useCallback(
    async (data: { name: string; description?: string }): Promise<ProductFamily | null> => {
      if (!empresaId) return null;

      const { data: newFamily, error } = await supabase
        .from("product_families")
        .insert({
          empresa_id: empresaId,
          name: data.name,
          description: data.description || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating family:", error);
        return null;
      }

      // Refresh list
      await refresh();
      return newFamily as ProductFamily;
    },
    [empresaId, refresh]
  );

  const updateFamily = useCallback(
    async (id: string, data: { name?: string; description?: string; active?: boolean }): Promise<boolean> => {
      const { error } = await supabase
        .from("product_families")
        .update(data)
        .eq("id", id);

      if (error) {
        console.error("Error updating family:", error);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh]
  );

  const deleteFamily = useCallback(
    async (id: string): Promise<boolean> => {
      // Instead of hard deleting, we do a soft delete to avoid foreign key constraint errors 
      // if there are products attached to this family.
      const { error } = await supabase
        .from("product_families")
        .update({ active: false })
        .eq("id", id);

      if (error) {
        console.error("Error deleting family:", error);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh]
  );

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  return {
    families,
    loading,
    error,
    refresh,
    createFamily,
    updateFamily,
    deleteFamily,
  };
};
