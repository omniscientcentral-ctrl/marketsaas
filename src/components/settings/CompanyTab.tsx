import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import CompanySettingsForm from "@/components/CompanySettingsForm";

const THRESHOLD_OPTIONS = [
  { value: "3", label: "3 días" },
  { value: "5", label: "5 días" },
  { value: "7", label: "7 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
  { value: "45", label: "45 días" },
  { value: "60", label: "60 días" },
];

const CompanyTab = () => {
  const empresaId = useEmpresaId();
  const [alertCritical, setAlertCritical] = useState(7);
  const [alertWarning, setAlertWarning] = useState(15);
  const [alertNotice, setAlertNotice] = useState(30);
  const [savingAlerts, setSavingAlerts] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from("company_settings")
      .select("alert_days_critical, alert_days_warning, alert_days_notice")
      .eq("empresa_id", empresaId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAlertCritical(data.alert_days_critical ?? 7);
          setAlertWarning(data.alert_days_warning ?? 15);
          setAlertNotice(data.alert_days_notice ?? 30);
        }
      });
  }, [empresaId]);

  const handleSaveAlerts = async () => {
    if (alertCritical >= alertWarning) {
      toast.error("El umbral Crítico debe ser menor que Advertencia");
      return;
    }
    if (alertWarning >= alertNotice) {
      toast.error("El umbral Advertencia debe ser menor que Aviso");
      return;
    }
    setSavingAlerts(true);
    try {
      const { error } = await supabase
        .from("company_settings")
        .update({
          alert_days_critical: alertCritical,
          alert_days_warning: alertWarning,
          alert_days_notice: alertNotice,
        })
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      toast.success("Umbrales de vencimiento guardados");
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSavingAlerts(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <CompanySettingsForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alertas de vencimiento
          </CardTitle>
          <CardDescription>
            Configura los umbrales en días para las alertas de productos próximos a vencer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-destructive font-medium">🔴 Crítico (días)</Label>
              <Select value={String(alertCritical)} onValueChange={(v) => setAlertCritical(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Productos que vencen en ≤ {alertCritical} días</p>
            </div>

            <div className="space-y-2">
              <Label className="font-medium" style={{ color: "hsl(var(--chart-4))" }}>🟠 Advertencia (días)</Label>
              <Select value={String(alertWarning)} onValueChange={(v) => setAlertWarning(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Productos que vencen entre {alertCritical + 1} y {alertWarning} días</p>
            </div>

            <div className="space-y-2">
              <Label className="font-medium" style={{ color: "hsl(var(--chart-3))" }}>🟡 Aviso (días)</Label>
              <Select value={String(alertNotice)} onValueChange={(v) => setAlertNotice(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Productos que vencen entre {alertWarning + 1} y {alertNotice} días</p>
            </div>
          </div>

          <Button onClick={handleSaveAlerts} disabled={savingAlerts}>
            {savingAlerts ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar umbrales"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyTab;
