import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, FileUp, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CsvColumnMapper from "./CsvColumnMapper";

interface ImportSectionProps {
  empresaId: string;
  empresaNombre: string;
}

type ImportStep = "upload" | "configure" | "preview" | "importing" | "done";

interface ImportResult {
  inserted: number;
  skipped: number;
  total: number;
  errors?: string[];
}

const IMPORTABLE_TABLES: Record<string, string> = {
  products: "Productos",
  customers: "Clientes",
  suppliers: "Proveedores",
  cash_registers: "Cajas Registradoras",
  company_settings: "Configuración",
};

const ImportSection = ({ empresaId, empresaNombre }: ImportSectionProps) => {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileType, setFileType] = useState<"json" | "csv" | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [tableName, setTableName] = useState<string>("");
  const [records, setRecords] = useState<any[]>([]);
  const [mappedRecords, setMappedRecords] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const reset = () => {
    setStep("upload");
    setFileType(null);
    setRawData(null);
    setTableName("");
    setRecords([]);
    setMappedRecords([]);
    setCsvHeaders([]);
    setResult(null);
    setProgress(0);
  };

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return obj;
    });
    return { headers, rows };
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "json") {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        setFileType("json");

        // Check if it's a full backup file
        if (parsed.version && parsed.data) {
          setRawData(parsed);
          // Auto-detect importable tables from backup
          const availableTables = Object.keys(parsed.data).filter(
            (t) => IMPORTABLE_TABLES[t] && parsed.data[t]?.length > 0
          );
          if (availableTables.length === 1) {
            setTableName(availableTables[0]);
            setRecords(parsed.data[availableTables[0]]);
            setMappedRecords(parsed.data[availableTables[0]]);
            setStep("preview");
          } else {
            setStep("configure");
          }
        } else if (Array.isArray(parsed)) {
          // Direct array of records
          setRawData(parsed);
          setRecords(parsed);
          setStep("configure");
        } else {
          toast.error("Formato JSON no reconocido");
        }
      } catch {
        toast.error("El archivo JSON no es válido");
      }
    } else if (ext === "csv") {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (rows.length === 0) {
        toast.error("El archivo CSV está vacío");
        return;
      }
      setFileType("csv");
      setCsvHeaders(headers);
      setRecords(rows);
      setStep("configure");
    } else {
      toast.error("Solo se aceptan archivos JSON o CSV");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const selectTableFromBackup = (table: string) => {
    if (rawData?.data?.[table]) {
      setTableName(table);
      setRecords(rawData.data[table]);
      setMappedRecords(rawData.data[table]);
      setStep("preview");
    }
  };

  const handleCsvMapped = (mapped: any[], targetTable: string) => {
    setTableName(targetTable);
    setMappedRecords(mapped);
    setStep("preview");
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");
    setProgress(10);

    try {
      setProgress(30);
      const { data, error } = await supabase.functions.invoke("backup-restore-empresa", {
        body: {
          action: "import",
          empresa_id: empresaId,
          table_name: tableName,
          data: mappedRecords,
        },
      });

      setProgress(90);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      setProgress(100);
      setStep("done");
      toast.success(`Importación completada: ${data.inserted} registros insertados`);
    } catch (e: any) {
      toast.error("Error al importar: " + e.message);
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const previewColumns = mappedRecords.length > 0 ? Object.keys(mappedRecords[0]).filter((k) => k !== "id" && k !== "empresa_id" && k !== "created_at" && k !== "updated_at").slice(0, 6) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Datos
        </CardTitle>
        <CardDescription>
          Carga archivos JSON (respaldo completo) o CSV (productos, clientes, proveedores) para insertar datos en la empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step: Upload */}
        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json,.csv";
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
          >
            <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium">Arrastra un archivo aquí o haz clic para seleccionar</p>
            <div className="flex justify-center gap-3 mt-3">
              <Badge variant="outline" className="gap-1">
                <FileJson className="h-3 w-3" /> JSON
              </Badge>
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" /> CSV
              </Badge>
            </div>
          </div>
        )}

        {/* Step: Configure (select table) */}
        {step === "configure" && (
          <div className="space-y-4">
            {fileType === "json" && rawData?.data ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Respaldo de <strong>{rawData.empresa?.nombre}</strong> del{" "}
                  {new Date(rawData.exported_at).toLocaleDateString()}
                </p>
                <p className="font-medium">Selecciona qué datos importar:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(IMPORTABLE_TABLES).map(([key, label]) => {
                    const count = rawData.data[key]?.length || 0;
                    return (
                      <Button
                        key={key}
                        variant={count > 0 ? "outline" : "ghost"}
                        disabled={count === 0}
                        onClick={() => selectTableFromBackup(key)}
                        className="justify-start"
                      >
                        {label}
                        <Badge variant="secondary" className="ml-auto">{count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : fileType === "csv" ? (
              <CsvColumnMapper
                headers={csvHeaders}
                sampleRows={records.slice(0, 3)}
                onMapped={handleCsvMapped}
                onCancel={reset}
              />
            ) : (
              <div className="space-y-3">
                <p className="font-medium">Selecciona el tipo de datos:</p>
                <Select value={tableName} onValueChange={(v) => {
                  setTableName(v);
                  setMappedRecords(records);
                  setStep("preview");
                }}>
                  <SelectTrigger><SelectValue placeholder="Tipo de datos" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMPORTABLE_TABLES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {IMPORTABLE_TABLES[tableName]} → <span className="text-primary">{empresaNombre}</span>
                </p>
                <p className="text-sm text-muted-foreground">{mappedRecords.length} registros a importar</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={reset}>Cancelar</Button>
                <Button onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Confirmar Importación
                </Button>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Los registros se insertarán como nuevos. Los IDs originales se reemplazan por nuevos UUIDs.
              </AlertDescription>
            </Alert>

            {mappedRecords.length > 0 && (
              <div className="overflow-x-auto max-h-64 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewColumns.map((col) => (
                        <TableHead key={col} className="text-xs">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRecords.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {previewColumns.map((col) => (
                          <TableCell key={col} className="text-xs max-w-[150px] truncate">
                            {String(row[col] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {mappedRecords.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    ... y {mappedRecords.length - 10} registros más
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="font-medium">Importando datos...</p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-lg font-medium">Importación completada</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                <p className="text-xs text-muted-foreground">Insertados</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {result.errors.map((e, i) => <p key={i} className="text-xs">{e}</p>)}
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={reset}>Nueva importación</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImportSection;
