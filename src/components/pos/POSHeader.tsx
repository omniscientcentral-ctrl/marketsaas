import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, User, Calendar, LogOut, DollarSign, PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/NotificationBell";

interface POSHeaderProps {
  userEmail: string | null | undefined;
  currentTime: Date;
  activeRole: string | null;
  isPOSBlocked: boolean;
  hasOpenSession: boolean;
  pendingSalesCount: number;
  onPendingSalesClick: () => void;
  onExpensesClick: () => void;
  onGenericProductClick: () => void;
  onReturnsClick: () => void;
  onCloseCashRegister: () => void;
}

export function POSHeader({
  userEmail,
  currentTime,
  activeRole,
  isPOSBlocked,
  hasOpenSession,
  pendingSalesCount,
  onPendingSalesClick,
  onExpensesClick,
  onGenericProductClick,
  onReturnsClick,
  onCloseCashRegister,
}: POSHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="px-4 py-2 flex items-center justify-between gap-4">
        {/* Sección Izquierda: Sidebar Trigger + Badge Consolidado */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />

          <div className="flex items-center gap-2 bg-primary/15 rounded-lg px-3 py-1.5">
            {/* Usuario */}
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{userEmail?.split("@")[0] || "Usuario"}</span>
            </div>

            <span className="text-primary/50">|</span>

            {/* Fecha */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm">{format(currentTime, "dd/MM/yyyy", { locale: es })}</span>
            </div>

            <span className="text-primary/50">|</span>

            {/* Hora */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-mono">{format(currentTime, "HH:mm:ss", { locale: es })}</span>
            </div>
          </div>
        </div>

        {/* Sección Central: Botones de Acción */}
        <div className="flex items-center gap-1">
          {/* Botón Ventas en Espera - con badge integrado */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onPendingSalesClick}
            disabled={isPOSBlocked}
            className={cn(
              "transition-colors",
              pendingSalesCount > 0
                ? "text-primary bg-primary/10 hover:bg-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
            aria-label={`Ventas en espera: ${pendingSalesCount}`}
          >
            <Clock className="h-4 w-4" />
            {pendingSalesCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs font-semibold">
                {pendingSalesCount}
              </Badge>
            )}
            <span className="hidden sm:inline ml-1.5">Ventas en Espera</span>
          </Button>

          {/* Separador vertical sutil */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Botón Gastos / Retiro de Caja */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpensesClick}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            aria-label="Registrar gasto"
          >
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Gastos</span>
          </Button>

          {/* Separador vertical sutil */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Botón Producto Genérico */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onGenericProductClick}
            disabled={isPOSBlocked}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            aria-label="Producto genérico (F8)"
          >
            <PackagePlus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Genérico (F8)</span>
          </Button>

          {/* Separador vertical sutil */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Botón Mermas - con color amber sutil para indicar atención */}
          {activeRole && ["admin", "supervisor", "cajero"].includes(activeRole) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReturnsClick}
              disabled={!hasOpenSession}
              className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              aria-label="Registrar mermas o devoluciones"
            >
              <PackageMinus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Mermas</span>
            </Button>
          )}

          {/* Campana de notificaciones */}
          <NotificationBell />
        </div>

        {/* Sección Derecha: Cerrar Caja */}
        {activeRole && ["admin", "supervisor", "cajero"].includes(activeRole) && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onCloseCashRegister}
            disabled={!hasOpenSession}
            className="ml-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Caja
          </Button>
        )}
      </div>
    </header>
  );
}
