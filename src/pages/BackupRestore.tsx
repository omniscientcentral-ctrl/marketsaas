import { Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MainLayout from "@/components/layout/MainLayout";
import { ExportSection } from "@/components/backup/ExportSection";
import { ImportSection } from "@/components/backup/ImportSection";

export default function BackupRestore() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Respaldos y Datos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Exporta e importa datos de la empresa seleccionada.
          </p>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList>
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
          </TabsList>
          <TabsContent value="export">
            <ExportSection />
          </TabsContent>
          <TabsContent value="import">
            <ImportSection />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
