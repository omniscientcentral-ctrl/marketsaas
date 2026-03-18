import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const EXPORT_OPTIONS = [
  { key: "products", label: "Productos" },
  { key: "customers", label: "Clientes" },
  { key: "suppliers", label: "Proveedores" },
  { key: "sales", label: "Ventas" },
  { key: "sale_items", label: "Detalle de ventas" },
  { key: "stock_movements", label: "Movimientos de stock" },
  { key: "cash_registers", label: "Cajas registradoras" },
  { key: "cash_register_sessions", label: "Sesiones de caja" },
  { key: "profiles", label: "Usuarios" },
  { key: "expenses", label: "Gastos" },
  { key: "credits", label: "Créditos" },
  { key: "credit_payments", label: "Pagos de créditos" },
] as const;

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportSection() {
  const empresaId = useEmpresaId();
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [loading, setLoading] = useState(false);

  const toggleTable = (key: string) => {
    setSelectedTables((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (!empresaId) {
      toast.error("Selecciona una empresa primero");
      return;
    }
    if (selectedTables.length === 0) {
      toast.error("Selecciona al menos una tabla");
      return;
    }

    setLoading(true);
    try {
      for (const tableName of selectedTables) {
        const { data: result, error } = await supabase.functions.invoke(
          "backup-restore-data",
          {
            body: { action: "export", empresa_id: empresaId, table_name: tableName },
          }
        );

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        const records = result.data || [];
        if (records.length === 0) {
          toast.info(`${tableName}: sin datos`);
          continue;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        if (format === "json") {
          downloadFile(
            JSON.stringify(records, null, 2),
            `${tableName}_${timestamp}.json`,
            "application/json"
          );
        } else {
          downloadFile(
            jsonToCsv(records),
            `${tableName}_${timestamp}.csv`,
            "text/csv"
          );
        }
      }
      toast.success("Exportación completada");
    } catch (err: any) {
      toast.error(`Error al exportar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar datos
        </CardTitle>
        <CardDescription>
          Selecciona los datos a exportar y el formato de descarga.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!empresaId && (
          <p className="text-sm text-destructive">
            Debes seleccionar una empresa para exportar datos.
          </p>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-medium">Tablas a exportar</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EXPORT_OPTIONS.map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <Checkbox
                  id={`export-${opt.key}`}
                  checked={selectedTables.includes(opt.key)}
                  onCheckedChange={() => toggleTable(opt.key)}
                  disabled={!empresaId}
                />
                <Label
                  htmlFor={`export-${opt.key}`}
                  className="text-sm cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Formato</Label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as "json" | "csv")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="json" id="format-json" />
              <Label htmlFor="format-json" className="flex items-center gap-1 cursor-pointer">
                <FileJson className="h-4 w-4" /> JSON
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="csv" id="format-csv" />
              <Label htmlFor="format-csv" className="flex items-center gap-1 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={handleExport}
          disabled={loading || !empresaId || selectedTables.length === 0}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Generar respaldo
        </Button>
      </CardContent>
    </Card>
  );
}
