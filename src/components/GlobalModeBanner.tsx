import { Globe, ShieldAlert } from "lucide-react";
import { useEmpresaContext } from "@/contexts/EmpresaContext";

export function GlobalModeBanner() {
  const { isGlobalMode } = useEmpresaContext();

  if (!isGlobalMode) return null;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-primary px-4 py-2 text-primary-foreground text-sm font-medium shadow-sm">
      <Globe className="h-4 w-4" />
      <span>Modo Global Empresas</span>
      <span className="hidden sm:inline">—</span>
      <span className="hidden sm:inline flex items-center gap-1">
        <ShieldAlert className="h-3.5 w-3.5" />
        Vista de solo lectura
      </span>
    </div>
  );
}
