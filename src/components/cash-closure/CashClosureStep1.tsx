import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CashClosureStep1Props {
  cashRegister: any;
  salesData: any;
  onNext: () => void;
}

export function CashClosureStep1({ cashRegister, salesData, onNext }: CashClosureStep1Props) {
  const hasPendingSales = salesData?.pendingSalesCount > 0;

  if (!cashRegister) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Inicio del Arqueo</h2>
          <p className="text-muted-foreground">Cargando datos de caja...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Inicio del Arqueo</h2>
        <p className="text-muted-foreground">
          Revisión de datos del turno antes de proceder con el cierre
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-semibold">Apertura de Caja</span>
          </div>
          <p className="text-2xl font-bold">
            {format(new Date(cashRegister.opened_at), "HH:mm", { locale: es })}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(cashRegister.opened_at), "dd 'de' MMMM, yyyy", { locale: es })}
          </p>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm">Monto de apertura</p>
            <p className="text-xl font-bold">${Number(cashRegister.opening_amount).toFixed(2)}</p>
          </div>
        </Card>

        <Card className="p-4 bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-semibold">Tickets Vendidos</span>
          </div>
          <p className="text-2xl font-bold">{salesData?.ticketCount || 0}</p>
          <p className="text-sm text-muted-foreground">Ventas completadas</p>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm">Total vendido</p>
            <p className="text-xl font-bold">
              ${(
                Number(salesData?.cashTotal || 0) +
                Number(salesData?.cardTotal || 0) +
                Number(salesData?.creditTotal || 0)
              ).toFixed(2)}
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Resumen de Ventas por Método de Pago</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
            <span className="font-medium">💵 Efectivo</span>
            <span className="text-lg font-bold">${Number(salesData?.cashTotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
            <span className="font-medium">💳 Tarjeta</span>
            <span className="text-lg font-bold">${Number(salesData?.cardTotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-orange-500/10 rounded-lg">
            <span className="font-medium">💰 Crédito/Fiado</span>
            <span className="text-lg font-bold">${Number(salesData?.creditTotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-lg">
            <span className="font-medium">🏦 Transferencia</span>
            <span className="text-lg font-bold">${Number(salesData?.transferTotal || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
            <span className="font-medium">🏦 Egresos/Gastos</span>
            <span className="text-lg font-bold">-${Number(salesData?.totalExpenses || 0).toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {hasPendingSales && (
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-600">Atención: Ventas en Espera</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tienes {salesData.pendingSalesCount} venta(s) en espera. 
                Considera completarlas o eliminarlas antes del cierre.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button onClick={onNext} size="lg">
          Continuar al Conteo de Efectivo
        </Button>
      </div>
    </div>
  );
}
