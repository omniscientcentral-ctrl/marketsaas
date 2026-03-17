import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Database, FileJson, FileSpreadsheet, Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const IMPORTABLE_TABLES: Record<string, string> = {
  products: "Productos",
  customers: "Clientes",
  suppliers: "Proveedores",
  cash_registers: "Cajas Registradoras",
  company_settings: "Configuración",
};

const CSV_COLUMN_MAP: Record<string, Record<string, string>> = {
  products: {
    nombre: "name", name: "name", codigo_barras: "barcode", barcode: "barcode",
    precio: "price", price: "price", costo: "cost", cost: "cost",
    stock: "stock", categoria: "category", category: "category",
  },
  customers: {
    nombre: "name", name: "name", apellido: "last_name", last_name: "last_name",
    telefono: "phone", phone: "phone", documento: "document", document: "document",
    rut: "rut", direccion: "address", address: "address",
    limite_credito: "credit_limit", credit_limit: "credit_limit",
  },
  suppliers: {
    nombre: "name", name: "name", telefono: "phone", phone: "phone",
    email: "email", rut: "tax_id", tax_id: "tax_id", notas: "notes", notes: "notes",
  },
};

type Step = "select" | "upload" | "table-select" | "csv-map" | "preview" | "importing" | "done";

interface ImportResult {
  inserted: number;
  skipped: number;
  total: number;
  errors?: string[];
}

const EmpresaBackup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedId = searchParams.get("empresa");

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(preselectedId || "");
  const [exporting, setExporting] = useState(false);

  // Import state
  const [step, setStep] = useState<Step>("upload");
  const [fileType, setFileType] = useState<"json" | "csv" | null>(null);
  const [backupData, setBackupData] = useState<any>(null);
  const [tableName, setTableName] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-backup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("id, nombre_empresa, estado")
        .order("nombre_empresa");
      return data || [];
    },
  });

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId);

  const resetImport = () => {
    setStep("upload");
    setFileType(null);
    setBackupData(null);
    setTableName("");
    setRecords([]);
    setCsvHeaders([]);
    setCsvMapping({});
    setResult(null);
    setProgress(0);
  };

  // Export
  const handleExport = async () => {
    if (!selectedEmpresaId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-restore-empresa", {
        body: { action: "export", empresa_id: selectedEmpresaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `backup_${(selectedEmpresa?.nombre_empresa || "empresa").replace(/\s+/g, "_")}_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(data.data as Record<string, any[]>).reduce(
        (sum: number, arr: any[]) => sum + (arr?.length || 0), 0
      );
      toast.success(`Respaldo exportado: ${totalRecords} registros`);
    } catch (e: any) {
      toast.error("Error al exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  // File handling
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string, string>[] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });
    return { headers, rows };
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "json") {
      try {
        const parsed = JSON.parse(await file.text());
        setFileType("json");
        if (parsed.version && parsed.data) {
          setBackupData(parsed);
          setStep("table-select");
        } else if (Array.isArray(parsed)) {
          setRecords(parsed);
          setStep("table-select");
        } else {
          toast.error("Formato JSON no reconocido");
        }
      } catch { toast.error("JSON inválido"); }
    } else if (ext === "csv") {
      const { headers, rows } = parseCSV(await file.text());
      if (rows.length === 0) { toast.error("CSV vacío"); return; }
      setFileType("csv");
      setCsvHeaders(headers);
      setRecords(rows);
      setStep("csv-map");
    } else {
      toast.error("Solo JSON o CSV");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // Select table from backup
  const selectTable = (table: string) => {
    setTableName(table);
    if (backupData?.data?.[table]) {
      setRecords(backupData.data[table]);
    }
    setStep("preview");
  };

  // CSV auto-map
  const autoMapCsv = (table: string) => {
    setTableName(table);
    const map = CSV_COLUMN_MAP[table] || {};
    const auto: Record<string, string> = {};
    for (const header of csvHeaders) {
      const dbCol = map[header.toLowerCase().trim()];
      if (dbCol) auto[header] = dbCol;
    }
    setCsvMapping(auto);
  };

  const applyCsvMapping = () => {
    const mapped = records.map((row) => {
      const obj: Record<string, any> = {};
      for (const [csvCol, dbCol] of Object.entries(csvMapping)) {
        if (dbCol && row[csvCol] !== undefined) {
          obj[dbCol] = row[csvCol] === "" ? null : row[csvCol];
        }
      }
      return obj;
    });
    setRecords(mapped);
    setStep("preview");
  };

  // Import
  const handleImport = async () => {
    setImporting(true);
    setStep("importing");
    setProgress(20);
    try {
      setProgress(40);
      const { data, error } = await supabase.functions.invoke("backup-restore-empresa", {
        body: { action: "import", empresa_id: selectedEmpresaId, table_name: tableName, data: records },
      });
      setProgress(90);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setProgress(100);
      setStep("done");
      toast.success(`${data.inserted} registros importados`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const previewCols = records.length > 0
    ? Object.keys(records[0]).filter((k) => !["id", "empresa_id", "created_at", "updated_at"].includes(k)).slice(0, 6)
    : [];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/empresas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Database className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Respaldo y Carga de Datos</h1>
        </div>

        {/* Empresa selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="font-medium whitespace-nowrap">Empresa:</label>
              <Select value={selectedEmpresaId} onValueChange={(v) => { setSelectedEmpresaId(v); resetImport(); }}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Selecciona una empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre_empresa}
                      {e.estado !== "activa" && <Badge variant="destructive" className="ml-2 text-xs">{e.estado}</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedEmpresaId && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* EXPORT */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Exportar Respaldo
                </CardTitle>
                <CardDescription>
                  Descarga un JSON con todos los datos operativos de la empresa.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExport} disabled={exporting} size="lg" className="w-full">
                  {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {exporting ? "Exportando..." : "Descargar Respaldo"}
                </Button>
              </CardContent>
            </Card>

            {/* IMPORT */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importar Datos
                </CardTitle>
                <CardDescription>
                  Carga JSON (respaldo) o CSV (productos, clientes, proveedores).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload step */}
                {step === "upload" && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
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
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium text-sm">Arrastra o selecciona archivo</p>
                    <div className="flex justify-center gap-2 mt-2">
                      <Badge variant="outline"><FileJson className="h-3 w-3 mr-1" />JSON</Badge>
                      <Badge variant="outline"><FileSpreadsheet className="h-3 w-3 mr-1" />CSV</Badge>
                    </div>
                  </div>
                )}

                {/* Table select (from JSON backup) */}
                {step === "table-select" && (
                  <div className="space-y-3">
                    {backupData?.empresa && (
                      <p className="text-sm text-muted-foreground">
                        Respaldo: <strong>{backupData.empresa.nombre}</strong> — {new Date(backupData.exported_at).toLocaleDateString()}
                      </p>
                    )}
                    <p className="font-medium text-sm">¿Qué datos importar?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(IMPORTABLE_TABLES).map(([key, label]) => {
                        const count = backupData?.data?.[key]?.length || (key === tableName ? records.length : 0);
                        const hasData = backupData ? (backupData.data?.[key]?.length || 0) > 0 : true;
                        return (
                          <Button key={key} variant="outline" disabled={!hasData} onClick={() => selectTable(key)} className="justify-between text-xs h-auto py-2">
                            {label}
                            {backupData && <Badge variant="secondary" className="ml-1">{count}</Badge>}
                          </Button>
                        );
                      })}
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetImport}>Cancelar</Button>
                  </div>
                )}

                {/* CSV column mapping */}
                {step === "csv-map" && (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-sm mb-2">Tipo de datos:</p>
                      <Select value={tableName} onValueChange={autoMapCsv}>
                        <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(IMPORTABLE_TABLES).filter(([k]) => CSV_COLUMN_MAP[k]).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tableName && (
                      <>
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">Mapeo de columnas:</p>
                          {csvHeaders.map((header) => (
                            <div key={header} className="flex items-center gap-2 text-sm">
                              <span className="w-28 truncate text-muted-foreground">{header}</span>
                              <span>→</span>
                              <Select
                                value={csvMapping[header] || "__none__"}
                                onValueChange={(v) => setCsvMapping((p) => ({ ...p, [header]: v === "__none__" ? "" : v }))}
                              >
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Ignorar —</SelectItem>
                                  {Object.entries(CSV_COLUMN_MAP[tableName] || {})
                                    .filter(([, v], _i, arr) => {
                                      // Show unique DB columns
                                      const idx = arr.findIndex(([, vv]) => vv === v);
                                      return idx === arr.findIndex(([, vv]) => vv === v);
                                    })
                                    .reduce((acc, [, dbCol]) => {
                                      if (!acc.find((a) => a === dbCol)) acc.push(dbCol);
                                      return acc;
                                    }, [] as string[])
                                    .map((dbCol) => (
                                      <SelectItem key={dbCol} value={dbCol}>{dbCol}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={resetImport}>Cancelar</Button>
                          <Button size="sm" onClick={applyCsvMapping} disabled={!Object.values(csvMapping).some(Boolean)}>
                            Continuar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Preview */}
                {step === "preview" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{IMPORTABLE_TABLES[tableName]} → {selectedEmpresa?.nombre_empresa}</p>
                        <p className="text-xs text-muted-foreground">{records.length} registros</p>
                      </div>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Se insertarán como registros nuevos con UUIDs nuevos.
                      </AlertDescription>
                    </Alert>
                    {records.length > 0 && (
                      <div className="overflow-x-auto max-h-48 border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {previewCols.map((c) => <TableHead key={c} className="text-xs py-1">{c}</TableHead>)}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {records.slice(0, 5).map((row, i) => (
                              <TableRow key={i}>
                                {previewCols.map((c) => (
                                  <TableCell key={c} className="text-xs py-1 max-w-[120px] truncate">{String(row[c] ?? "—")}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {records.length > 5 && <p className="text-xs text-muted-foreground text-center py-1">+{records.length - 5} más</p>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={resetImport}>Cancelar</Button>
                      <Button size="sm" onClick={handleImport}>
                        <Upload className="h-3.5 w-3.5 mr-1" />Importar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Importing */}
                {step === "importing" && (
                  <div className="space-y-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <p className="text-sm font-medium">Importando...</p>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}

                {/* Done */}
                {step === "done" && result && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="font-medium">Completado</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-lg font-bold">{result.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-lg font-bold text-green-600">{result.inserted}</p>
                        <p className="text-[10px] text-muted-foreground">Insertados</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-lg font-bold text-yellow-600">{result.skipped}</p>
                        <p className="text-[10px] text-muted-foreground">Omitidos</p>
                      </div>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription className="text-xs">
                          {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button size="sm" onClick={resetImport}>Nueva importación</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default EmpresaBackup;
