import { useState, useRef } from "react";
import { Upload, FileUp, Loader2, CheckCircle2, XCircle, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { ColumnPreview } from "./ColumnPreview";

const IMPORT_OPTIONS = [
  { key: "products", label: "Productos" },
  { key: "customers", label: "Clientes" },
  { key: "suppliers", label: "Proveedores" },
] as const;

const IMPORT_SCHEMAS: Record<string, { name: string; required: boolean; type: string }[]> = {
  products: [
    { name: "name", required: true, type: "string" },
    { name: "barcode", required: false, type: "string" },
    { name: "price", required: true, type: "number" },
    { name: "stock", required: false, type: "number" },
    { name: "cost", required: false, type: "number" },
    { name: "min_stock", required: false, type: "number" },
    { name: "category", required: false, type: "string" },
    { name: "active", required: false, type: "boolean" },
    { name: "stock_disabled", required: false, type: "boolean" },
    { name: "allow_negative_stock", required: false, type: "boolean" },
  ],
  customers: [
    { name: "name", required: true, type: "string" },
    { name: "last_name", required: false, type: "string" },
    { name: "document", required: false, type: "string" },
    { name: "rut", required: false, type: "string" },
    { name: "phone", required: false, type: "string" },
    { name: "address", required: false, type: "string" },
    { name: "credit_limit", required: false, type: "number" },
    { name: "notes", required: false, type: "string" },
    { name: "status", required: false, type: "string" },
  ],
  suppliers: [
    { name: "name", required: true, type: "string" },
    { name: "phone", required: false, type: "string" },
    { name: "email", required: false, type: "string" },
    { name: "tax_id", required: false, type: "string" },
    { name: "notes", required: false, type: "string" },
    { name: "is_active", required: false, type: "boolean" },
  ],
};

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsv(rawText: string): Record<string, string>[] {
  // Strip BOM
  const text = rawText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

interface ValidationResult {
  dry_run: boolean;
  total: number;
  valid: number;
  invalid: number;
  errors: { row: number; errors: string[] }[];
}

interface ImportResult {
  dry_run: boolean;
  total: number;
  inserted: number;
  skipped_validation: number;
  validation_errors: { row: number; errors: string[] }[];
  insert_errors: { row: number; error: string }[];
}

export function ImportSection() {
  const empresaId = useEmpresaId();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"validate" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationResult(null);
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let parsed: Record<string, unknown>[];

        if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          parsed = Array.isArray(json) ? json : [json];
        } else {
          parsed = parseCsv(text);
        }

        if (parsed.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        setRecords(parsed);
        setDetectedColumns(Object.keys(parsed[0]));
      } catch {
        toast.error("Error al leer el archivo");
      }
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!empresaId || !selectedTable || records.length === 0) return;
    setLoading(true);
    setAction("validate");
    try {
      const { data, error } = await supabase.functions.invoke("backup-restore-data", {
        body: {
          action: "import",
          empresa_id: empresaId,
          table_name: selectedTable,
          records,
          dry_run: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValidationResult(data);
      setImportResult(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleImport = async () => {
    if (!empresaId || !selectedTable || records.length === 0) return;
    setLoading(true);
    setAction("import");
    try {
      const { data, error } = await supabase.functions.invoke("backup-restore-data", {
        body: {
          action: "import",
          empresa_id: empresaId,
          table_name: selectedTable,
          records,
          dry_run: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImportResult(data);
      setValidationResult(null);
      toast.success(`${data.inserted} registros importados correctamente`);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const reset = () => {
    setRecords([]);
    setDetectedColumns([]);
    setFileName("");
    setValidationResult(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar datos
        </CardTitle>
        <CardDescription>
          Carga un archivo CSV o JSON para importar datos a la empresa seleccionada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!empresaId && (
          <p className="text-sm text-destructive">
            Debes seleccionar una empresa para importar datos.
          </p>
        )}

        <div className="space-y-3">
          <Label>Tipo de datos</Label>
          <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); reset(); }}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTable && (
          <div className="space-y-3">
            <Label>Archivo (CSV o JSON)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              {fileName ? (
                <p className="text-sm font-medium">{fileName} ({records.length} registros)</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Haz clic para seleccionar un archivo .csv o .json
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}

        {detectedColumns.length > 0 && selectedTable && (
          <ColumnPreview
            expectedColumns={IMPORT_SCHEMAS[selectedTable]}
            detectedColumns={detectedColumns}
          />
        )}

        {validationResult && (
          <Alert variant={validationResult.invalid > 0 ? "destructive" : "default"}>
            <AlertDescription className="space-y-2">
              <div className="flex items-center gap-2">
                {validationResult.invalid === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  Validación: {validationResult.valid} válidos, {validationResult.invalid} con errores
                </span>
              </div>
              {validationResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto text-xs space-y-1 mt-2">
                  {validationResult.errors.slice(0, 20).map((e) => (
                    <p key={e.row} className="text-destructive">
                      Fila {e.row}: {e.errors.join("; ")}
                    </p>
                  ))}
                  {validationResult.errors.length > 20 && (
                    <p className="text-muted-foreground">
                      ... y {validationResult.errors.length - 20} errores más
                    </p>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {importResult && (
          <Alert>
            <AlertDescription className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">
                  Importación completada: {importResult.inserted} insertados
                </span>
              </div>
              {importResult.skipped_validation > 0 && (
                <p className="text-xs text-muted-foreground">
                  {importResult.skipped_validation} omitidos por validación
                </p>
              )}
              {importResult.insert_errors.length > 0 && (
                <div className="text-xs space-y-1">
                  {importResult.insert_errors.map((e) => (
                    <p key={e.row} className="text-destructive">
                      Lote desde fila {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {records.length > 0 && selectedTable && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={loading || !empresaId}
              className="flex-1"
            >
              {loading && action === "validate" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Validar archivo
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || !empresaId}
              className="flex-1"
            >
              {loading && action === "import" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar datos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
