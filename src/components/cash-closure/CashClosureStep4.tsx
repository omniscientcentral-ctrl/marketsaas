import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

interface CashClosureStep4Props {
  difference: number;
  approvalThreshold: number;
  reason: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const COMMON_REASONS = [
  "Error en el conteo manual",
  "Cambio entregado incorrectamente",
  "Falta de comprobante de egreso",
  "Venta no registrada correctamente",
  "Gasto no declarado",
  "Error en carga de sistema",
];

export function CashClosureStep4({ difference, approvalThreshold, reason, onChange, onNext, onBack }: CashClosureStep4Props) {
  if (Math.abs(difference) === 0) {
    // Skip this step if no difference
    onNext();
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Justificación de Diferencia</h2>
        <p className="text-muted-foreground">
          Indica el motivo de la diferencia detectada en el arqueo
        </p>
      </div>

      <Card className={`p-6 ${
        Math.abs(difference) > approvalThreshold 
          ? "bg-red-500/10 border-red-500/50" 
          : "bg-yellow-500/10 border-yellow-500/50"
      }`}>
        <div className="flex items-center gap-3">
          <AlertCircle className={`h-8 w-8 ${
            Math.abs(difference) > approvalThreshold ? "text-red-600" : "text-yellow-600"
          }`} />
          <div>
            <p className="font-semibold text-lg">
              Diferencia de ${Math.abs(difference).toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">
              {difference > 0 ? "Sobrante en caja" : "Faltante en caja"}
            </p>
          </div>
        </div>
      </Card>

      <div>
        <Label className="text-base font-semibold mb-3 block">
          Motivos Comunes (selecciona uno o escribe tu propio motivo)
        </Label>
        <div className="grid gap-2 md:grid-cols-2">
          {COMMON_REASONS.map((commonReason) => (
            <Button
              key={commonReason}
              variant={reason === commonReason ? "default" : "outline"}
              onClick={() => onChange(commonReason)}
              className="justify-start text-left h-auto py-3"
            >
              {commonReason}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-reason" className="text-base font-semibold">
          Descripción Detallada
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          Proporciona detalles adicionales sobre la causa de la diferencia
        </p>
        <Textarea
          id="custom-reason"
          value={reason}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ejemplo: Durante el turno se recibió un billete falso de $100 que no fue detectado en el momento..."
          className="min-h-[120px]"
        />
      </div>

      {Math.abs(difference) > approvalThreshold && (
        <Card className="p-4 bg-orange-500/10 border-orange-500/50">
          <p className="font-semibold text-orange-600 mb-1">
            ⚠️ Requiere Aprobación de Supervisor
          </p>
          <p className="text-sm text-muted-foreground">
            La diferencia supera ${approvalThreshold}. Un supervisor o administrador 
            deberá revisar y aprobar este cierre antes de completarlo.
          </p>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button 
          onClick={onNext} 
          size="lg"
          disabled={!reason.trim()}
        >
          Continuar a Confirmación
        </Button>
      </div>
    </div>
  );
}
