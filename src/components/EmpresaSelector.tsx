import { Building2, Globe } from "lucide-react";
import { useEmpresaContext, GLOBAL_EMPRESAS_KEY } from "@/contexts/EmpresaContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function EmpresaSelector() {
  const { empresas, selectedEmpresaId, setSelectedEmpresaId, isSuperAdmin, isGlobalMode, loading } =
    useEmpresaContext();

  if (!isSuperAdmin || loading) return null;

  const currentValue = isGlobalMode ? GLOBAL_EMPRESAS_KEY : (selectedEmpresaId || "");

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={currentValue} onValueChange={setSelectedEmpresaId}>
        <SelectTrigger className="h-8 w-[200px] md:w-[260px] text-xs">
          <SelectValue placeholder="Seleccionar empresa..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={GLOBAL_EMPRESAS_KEY}>
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Global Empresas</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                Solo lectura
              </Badge>
            </div>
          </SelectItem>
          <Separator className="my-1" />
          {empresas.map((empresa) => (
            <SelectItem key={empresa.id} value={empresa.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{empresa.nombre_empresa}</span>
                {empresa.estado !== "activa" && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {empresa.estado}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
