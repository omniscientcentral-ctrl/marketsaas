import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, CreditCard } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import PlanCard from "@/components/planes/PlanCard";
import PlanDialog from "@/components/planes/PlanDialog";
import type { Plan } from "@/components/planes/PlanCard";
import type { PlanFormData } from "@/components/planes/PlanDialog";

const Planes = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: planes = [], isLoading } = useQuery({
    queryKey: ["planes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
    staleTime: 1000 * 60 * 15,
  });

  const { data: empresaCounts = {} } = useQuery({
    queryKey: ["planes-empresa-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("plan");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((e: any) => {
        if (e.plan) counts[e.plan] = (counts[e.plan] || 0) + 1;
      });
      return counts;
    },
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: PlanFormData }) => {
      if (id) {
        const { error } = await supabase.from("planes").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planes").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planes"] });
      toast.success(editingPlan ? "Plan actualizado" : "Plan creado");
      setDialogOpen(false);
      setEditingPlan(null);
    },
    onError: (err: any) => {
      toast.error("Error: " + err.message);
    },
  });

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const handleSave = (data: PlanFormData) => {
    saveMutation.mutate({ id: editingPlan?.id, data });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Gestión de Planes</h1>
          </div>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Plan
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando planes...</p>
        ) : planes.length === 0 ? (
          <p className="text-muted-foreground">No hay planes configurados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planes.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                empresaCount={empresaCounts[plan.id] || 0}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      <PlanDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingPlan(null); }}
        onSave={handleSave}
        initialData={editingPlan}
        loading={saveMutation.isPending}
      />
    </MainLayout>
  );
};

export default Planes;
