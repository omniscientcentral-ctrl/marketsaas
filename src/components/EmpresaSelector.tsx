import { Building2 } from "lucide-react";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function EmpresaSelector() {
  const { empresas, selectedEmpresaId, setSelectedEmpresaId, isSuperAdmin, loading } =
    useEmpresaContext();

  if (!isSuperAdmin || loading) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedEmpresaId || ""} onValueChange={setSelectedEmpresaId}>
        <SelectTrigger className="h-8 w-[200px] md:w-[260px] text-xs">
          <SelectValue placeholder="Seleccionar empresa..." />
        </SelectTrigger>
        <SelectContent>
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
