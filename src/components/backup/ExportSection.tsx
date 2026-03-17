import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ExportSectionProps {
  empresaId: string;
  empresaNombre: string;
}

const ExportSection = ({ empresaId, empresaNombre }: ExportSectionProps) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-restore-empresa", {
        body: { action: "export", empresa_id: empresaId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `backup_${empresaNombre.replace(/\s+/g, "_")}_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(data.data as Record<string, any[]>).reduce(
        (sum: number, arr: any[]) => sum + (arr?.length || 0),
        0
      );
      toast.success(`Respaldo exportado: ${totalRecords} registros`);
    } catch (e: any) {
      toast.error("Error al exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Exportar Respaldo
        </CardTitle>
        <CardDescription>
          Descarga un archivo JSON con todos los datos operativos de la empresa: productos, clientes, proveedores, ventas, créditos y más.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={exporting} size="lg">
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {exporting ? "Exportando..." : "Descargar Respaldo JSON"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExportSection;
