import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

interface CashClosureStep3Props {
  expectedCash: number;
  countedCash: number;
  cardTotal: number;
  creditTotal: number;
  expenses: number;
  difference: number;
  approvalThreshold: number;
  onNext: () => void;
  onBack: () => void;
}

export function CashClosureStep3({
  expectedCash,
  countedCash,
  cardTotal,
  creditTotal,
  expenses,
  difference,
  approvalThreshold,
  onNext,
  onBack,
}: CashClosureStep3Props) {
  const getDifferenceStatus = () => {
    const absDiff = Math.abs(difference);
    if (absDiff === 0) return "perfect";
    if (absDiff <= approvalThreshold) return "minor";
    return "major";
  };

  const status = getDifferenceStatus();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Comparación Automática</h2>
        <p className="text-muted-foreground">
          Verificación entre el efectivo esperado y contado
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 bg-blue-500/10 border-blue-500/50">
          <p className="text-sm font-medium text-muted-foreground mb-2">Efectivo Esperado</p>
          <p className="text-3xl font-bold">${expectedCash.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            (Apertura + Ventas - Egresos)
          </p>
        </Card>

        <Card className="p-6 bg-green-500/10 border-green-500/50">
          <p className="text-sm font-medium text-muted-foreground mb-2">Efectivo Contado</p>
          <p className="text-3xl font-bold">${countedCash.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            (Suma de denominaciones)
          </p>
        </Card>
      </div>

      <Card className={`p-6 ${
        status === "perfect" 
          ? "bg-green-500/10 border-green-500/50" 
          : status === "minor"
          ? "bg-yellow-500/10 border-yellow-500/50"
          : "bg-red-500/10 border-red-500/50"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === "perfect" && <CheckCircle2 className="h-8 w-8 text-green-600" />}
            {status === "minor" && <AlertTriangle className="h-8 w-8 text-yellow-600" />}
            {status === "major" && <AlertCircle className="h-8 w-8 text-red-600" />}
            <div>
              <p className="text-lg font-semibold">Diferencia</p>
              <p className="text-sm text-muted-foreground">
                {status === "perfect" && "¡Perfecto! El cierre cuadra exactamente"}
                {status === "minor" && "Diferencia menor detectada"}
                {status === "major" && "Diferencia significativa - Requiere revisión"}
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

      <div className="grid gap-3">
        <h3 className="font-semibold text-lg">Resumen Completo del Turno</h3>
        
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">💵 Ventas en efectivo</span>
              <span className="font-semibold">${expectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">💳 Ventas con tarjeta</span>
              <span className="font-semibold">${cardTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">💰 Ventas a crédito</span>
              <span className="font-semibold">${creditTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">🏦 Egresos/Gastos</span>
              <span className="font-semibold text-red-500">-${expenses.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-bold">Total del día</span>
              <span className="text-xl font-bold">
                ${(expectedCash + cardTotal + creditTotal).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {Math.abs(difference) > approvalThreshold && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La diferencia supera ${approvalThreshold}. Este cierre requerirá aprobación de un supervisor.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button onClick={onNext} size="lg">
          {Math.abs(difference) > 0 ? "Justificar Diferencia" : "Continuar a Confirmación"}
        </Button>
      </div>
    </div>
  );
}
