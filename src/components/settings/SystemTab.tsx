import { useState, useRef } from "react";
import { Package, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CleanupResult {
  [table: string]: number;
}

const TABLES_TO_CLEAN = [
  "credit_payments",
  "credits",
  "sale_items",
  "price_override_logs",
  "sale_print_audit",
  "notifications",
  "sales",
  "stock_movements",
  "stock_override_audit",
  "supervisor_authorizations",
  "returns",
  "cash_register_expenses",
  "cash_register_audit",
  "cash_register_takeover_audit",
  "cash_register_sessions",
  "cash_register",
  "pending_sales",
  "inventory_counts",
  "notification_audit",
];

const THRESHOLD_OPTIONS = [
  { value: "3", label: "3 días" },
  { value: "5", label: "5 días" },
  { value: "7", label: "7 días" },
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
  { value: "45", label: "45 días" },
  { value: "60", label: "60 días" },
];

const SystemTab = () => {
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
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CleanupResult | null>(null);
  const [isRunningProducts, setIsRunningProducts] = useState(false);
  const [productResults, setProductResults] = useState<CleanupResult | null>(null);
  const [showProductConfirm2, setShowProductConfirm2] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCleanup = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("No hay sesión activa");
        return;
      }

      const response = await supabase.functions.invoke("cleanup-test-data", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        throw new Error(response.error.message || "Error en la limpieza");
      }

      const data = response.data;
      if (data?.error) {
        throw new Error(data.error);
      }

      setResults(data?.deleted || {});
      const total = Object.values(data?.deleted || {}).reduce((sum: number, v: any) => sum + (v || 0), 0);
      toast.success(`Limpieza completada: ${total} registros eliminados`);
    } catch (error: any) {
      console.error("Cleanup error:", error);
      toast.error(error.message || "Error al limpiar datos de testing");
    } finally {
      setIsRunning(false);
    }
  };

  const handleProductCleanup = async () => {
    setIsRunningProducts(true);
    setProductResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("No hay sesión activa");
        return;
      }

      const response = await supabase.functions.invoke("cleanup-products", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Error en la limpieza");
      const data = response.data;
      if (data?.error) throw new Error(data.error);

      setProductResults(data?.deleted || {});
      const total = Object.values(data?.deleted || {}).reduce((sum: number, v: any) => sum + (v || 0), 0);
      toast.success(`Limpieza completada: ${total} registros afectados`);
    } catch (error: any) {
      console.error("Product cleanup error:", error);
      toast.error(error.message || "Error al eliminar productos");
    } finally {
      setIsRunningProducts(false);
      setShowProductConfirm2(false);
    }
  };

  const totalDeleted = results
    ? Object.values(results).reduce((sum, v) => sum + (v || 0), 0)
    : 0;

  const totalProductsDeleted = productResults
    ? Object.values(productResults).reduce((sum, v) => sum + (v || 0), 0)
    : 0;

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportResults(null);
    setImportProgress(5);

    try {
      const text = await selectedFile.text();
      const lines = text.split("\n");
      const header = lines[0];
      const dataLines = lines.slice(1).filter(l => l.trim());

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("No hay sesión activa");
        return;
      }

      const CHUNK_SIZE = 5000;
      const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
      let totalInserted = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        const chunk = dataLines.slice(i, i + CHUNK_SIZE);
        const csvChunk = [header, ...chunk].join("\n");
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

        setImportProgress(Math.round((chunkIndex / totalChunks) * 90) + 5);

        const response = await supabase.functions.invoke("import-products", {
          body: { csv: csvChunk },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.error) {
          allErrors.push(`Chunk ${chunkIndex}: ${response.error.message}`);
          continue;
        }
        const data = response.data;
        if (data?.error) {
          allErrors.push(`Chunk ${chunkIndex}: ${data.error}`);
          continue;
        }

        totalInserted += data.inserted || 0;
        totalSkipped += data.skipped || 0;
        if (data.errors?.length) allErrors.push(...data.errors.map((e: string) => `Chunk ${chunkIndex}: ${e}`));
      }

      setImportResults({ inserted: totalInserted, skipped: totalSkipped, errors: allErrors });
      setImportProgress(100);
      toast.success(`Importación completada: ${totalInserted} productos insertados (${totalChunks} chunks)`);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Error al importar productos");
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpiar datos de testing
          </CardTitle>
          <CardDescription>
            Elimina todos los registros generados por usuarios con email <strong>@soporte.com</strong> (ventas, movimientos de stock, sesiones de caja, créditos, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Tablas que serán limpiadas:</p>
            <div className="flex flex-wrap gap-1.5">
              {TABLES_TO_CLEAN.map((table) => (
                <Badge key={table} variant="outline" className="text-xs">
                  {table}
                </Badge>
              ))}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Limpiando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpiar datos de testing
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará <strong>permanentemente</strong> todos los datos de ventas, movimientos, sesiones de caja y más generados por usuarios @soporte.com. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCleanup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {results && (
            <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Limpieza completada — {totalDeleted} registros eliminados
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(results).map(([table, count]) => (
                  <div key={table} className="flex justify-between gap-2 rounded bg-background px-2 py-1">
                    <span className="text-muted-foreground truncate">{table}</span>
                    <span className="font-mono font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-destructive" />
            Eliminar todos los productos
          </CardTitle>
          <CardDescription>
            Elimina <strong>todos</strong> los productos y sus datos referenciales (lotes, stock, movimientos). Los items de venta y devoluciones se conservan con product_id = NULL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isRunningProducts}>
                {isRunningProducts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando productos...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar todos los productos
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto eliminará <strong>permanentemente</strong> todos los productos, lotes, balances de stock y movimientos. Los registros de ventas se conservarán pero perderán la referencia al producto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => setShowProductConfirm2(true)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, continuar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showProductConfirm2} onOpenChange={setShowProductConfirm2}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmación final</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta es la <strong>última confirmación</strong>. Se eliminarán TODOS los productos del sistema. ¿Deseas continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleProductCleanup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar todo definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {productResults && (
            <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Eliminación completada — {totalProductsDeleted} registros afectados
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(productResults).map(([table, count]) => (
                  <div key={table} className="flex justify-between gap-2 rounded bg-background px-2 py-1">
                    <span className="text-muted-foreground truncate">{table}</span>
                    <span className="font-mono font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar productos desde CSV
          </CardTitle>
          <CardDescription>
            Importa productos masivamente desde un archivo CSV con columnas: <strong>name, barcode, price</strong>. Los productos se crean con stock=0 y cost=0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              disabled={isImporting}
              className="max-w-xs"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!selectedFile || isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar importación</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se importarán todos los productos del archivo <strong>{selectedFile?.name}</strong>. Los productos existentes no serán modificados (se agregarán nuevos registros).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImport}>
                    Sí, importar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <Progress value={importProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Procesando archivo...</p>
            </div>
          )}

          {importResults && (
            <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Importación completada
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between gap-2 rounded bg-background px-2 py-1">
                  <span className="text-muted-foreground">Insertados</span>
                  <span className="font-mono font-medium">{importResults.inserted}</span>
                </div>
                <div className="flex justify-between gap-2 rounded bg-background px-2 py-1">
                  <span className="text-muted-foreground">Omitidos</span>
                  <span className="font-mono font-medium">{importResults.skipped}</span>
                </div>
              </div>
              {importResults.errors.length > 0 && (
                <div className="mt-2 text-xs text-destructive space-y-1">
                  {importResults.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expiration Alert Thresholds */}
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

export default SystemTab;
