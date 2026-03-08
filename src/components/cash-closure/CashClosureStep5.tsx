import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, AlertCircle, Loader2, FileText, Printer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CashClosureStep5Props {
  cashRegister: any;
  salesData: any;
  countedCash: number;
  difference: number;
  reason: string;
  denominations: any;
  approvalThreshold: number;
  printType: "a4" | "tickeadora" | "no_imprimir";
  onPrintTypeChange: (value: "a4" | "tickeadora" | "no_imprimir") => void;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}

export function CashClosureStep5({
  cashRegister,
  salesData,
  countedCash,
  difference,
  reason,
  denominations,
  approvalThreshold,
  printType,
  onPrintTypeChange,
  onConfirm,
  onBack,
  loading,
}: CashClosureStep5Props) {
  const requiresSupervisor = Math.abs(difference) > approvalThreshold;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Confirmación Final</h2>
        <p className="text-muted-foreground">
          Revisa todos los datos antes de completar el cierre de caja
        </p>
      </div>

      <Card className="p-6 bg-muted/50">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Apertura</p>
            <p className="text-lg font-semibold">
              {format(new Date(cashRegister.opened_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Cierre</p>
            <p className="text-lg font-semibold">
              {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Tickets Vendidos</p>
            <p className="text-lg font-semibold">{salesData?.ticketCount || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Monto Apertura</p>
            <p className="text-lg font-semibold">${Number(cashRegister.opening_amount).toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-green-500/10 border-green-500/50">
          <p className="text-sm text-muted-foreground mb-1">💵 Efectivo</p>
          <p className="text-2xl font-bold">${countedCash.toFixed(2)}</p>
        </Card>
        <Card className="p-4 bg-blue-500/10 border-blue-500/50">
          <p className="text-sm text-muted-foreground mb-1">💳 Tarjetas</p>
          <p className="text-2xl font-bold">${Number(salesData?.cardTotal || 0).toFixed(2)}</p>
        </Card>
        <Card className="p-4 bg-orange-500/10 border-orange-500/50">
          <p className="text-sm text-muted-foreground mb-1">💰 Créditos</p>
          <p className="text-2xl font-bold">${Number(salesData?.creditTotal || 0).toFixed(2)}</p>
        </Card>
      </div>

      <Card className={`p-6 ${
        Math.abs(difference) === 0
          ? "bg-green-500/10 border-green-500/50"
          : Math.abs(difference) > approvalThreshold
          ? "bg-red-500/10 border-red-500/50"
          : "bg-yellow-500/10 border-yellow-500/50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Math.abs(difference) === 0 ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <AlertCircle className={`h-8 w-8 ${
                Math.abs(difference) > approvalThreshold ? "text-red-600" : "text-yellow-600"
              }`} />
            )}
            <div>
              <p className="text-lg font-semibold">
                {Math.abs(difference) === 0 ? "Cierre Perfecto" : "Diferencia Detectada"}
              </p>
              <p className="text-sm text-muted-foreground">
                {Math.abs(difference) === 0 
                  ? "El arqueo cuadra exactamente" 
                  : difference > 0 
                  ? "Sobrante en caja" 
                  : "Faltante en caja"}
              </p>
            </div>
          </div>
          <p className={`text-3xl font-bold ${
            difference === 0 
              ? "text-green-600" 
              : difference > 0 
              ? "text-green-600" 
              : "text-red-600"
          }`}>
            {difference > 0 ? "+" : ""}{difference.toFixed(2)}
          </p>
        </div>
      </Card>

      {reason && (
        <Card className="p-4 bg-muted">
          <p className="text-sm font-semibold mb-2">📝 Motivo de la diferencia:</p>
          <p className="text-sm">{reason}</p>
        </Card>
      )}

      {requiresSupervisor && (
        <Alert className="bg-orange-500/10 border-orange-500/50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-600">
            <span className="font-semibold">Requiere Aprobación de Supervisor</span>
            <br />
            Este cierre quedará en estado "Pendiente de Aprobación" hasta que un supervisor 
            o administrador lo revise y apruebe.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6 bg-primary/5">
        <div className="flex items-center gap-3 mb-4">
          <Printer className="h-5 w-5 text-primary" />
          <p className="font-semibold">¿Deseas imprimir el resumen del cierre?</p>
        </div>
        <RadioGroup value={printType} onValueChange={onPrintTypeChange}>
          <div className="flex items-center space-x-2 mb-3">
            <RadioGroupItem value="a4" id="a4" />
            <Label htmlFor="a4" className="cursor-pointer">
              📄 Hoja A4 - Resumen completo para archivo
            </Label>
          </div>
          <div className="flex items-center space-x-2 mb-3">
            <RadioGroupItem value="tickeadora" id="tickeadora" />
            <Label htmlFor="tickeadora" className="cursor-pointer">
              🧾 Ticket - Resumen compacto para registro
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no_imprimir" id="no_imprimir" />
            <Label htmlFor="no_imprimir" className="cursor-pointer">
              ❌ No imprimir
            </Label>
          </div>
        </RadioGroup>
      </Card>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <p className="font-semibold text-sm">Al confirmar se generará:</p>
        </div>
        <ul className="space-y-2 text-xs ml-8 text-muted-foreground">
          <li>✓ Registro completo del cierre en el sistema</li>
          <li>✓ Reporte detallado con todos los movimientos</li>
          <li>✓ Historial de denominaciones contadas</li>
          <li>✓ Timestamp con fecha y hora exacta</li>
          {requiresSupervisor && <li>✓ Notificación al supervisor para aprobación</li>}
        </ul>
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          Atrás
        </Button>
        <Button onClick={onConfirm} size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            <>Confirmar Cierre de Caja</>
          )}
        </Button>
      </div>
    </div>
  );
}
