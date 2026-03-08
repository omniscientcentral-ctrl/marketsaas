import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, Calculator, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type CountingMode = "denominations" | "direct";

interface CashClosureStep2Props {
  denominations: any;
  onChange: (value: any) => void;
  onNext: () => void;
  onBack: () => void;
  directTotal: number;
  onDirectTotalChange: (value: number) => void;
  countingMode: CountingMode;
  onCountingModeChange: (mode: CountingMode) => void;
}

const DENOMINATIONS = [
  { value: "1000", label: "$1000" },
  { value: "500", label: "$500" },
  { value: "200", label: "$200" },
  { value: "100", label: "$100" },
  { value: "50", label: "$50" },
  { value: "20", label: "$20" },
  { value: "10", label: "$10" },
  { value: "5", label: "$5" },
  { value: "2", label: "$2" },
  { value: "1", label: "$1" },
];

export function CashClosureStep2({ 
  denominations, 
  onChange, 
  onNext, 
  onBack,
  directTotal,
  onDirectTotalChange,
  countingMode,
  onCountingModeChange
}: CashClosureStep2Props) {
  const [directInput, setDirectInput] = useState(directTotal > 0 ? directTotal.toString() : "");

  const handleDenominationChange = (denom: string, value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({ ...denominations, [denom]: numValue });
  };

  const handleDirectInputChange = (value: string) => {
    setDirectInput(value);
    const numValue = parseFloat(value) || 0;
    onDirectTotalChange(numValue);
  };

  const getTotalCounted = () => {
    if (countingMode === "direct") {
      return directTotal;
    }
    return Object.entries(denominations).reduce(
      (sum, [denom, count]) => sum + Number(denom) * Number(count),
      0
    );
  };

  const total = getTotalCounted();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Conteo de Efectivo</h2>
        <p className="text-muted-foreground">
          Elegí cómo querés contar el efectivo en caja
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant={countingMode === "denominations" ? "default" : "outline"}
          className={cn(
            "h-auto py-4 flex flex-col gap-2",
            countingMode === "denominations" && "ring-2 ring-primary"
          )}
          onClick={() => onCountingModeChange("denominations")}
        >
          <Coins className="h-6 w-6" />
          <span className="font-semibold">Por Billetes</span>
          <span className="text-xs opacity-70">Conteo detallado</span>
        </Button>
        <Button
          type="button"
          variant={countingMode === "direct" ? "default" : "outline"}
          className={cn(
            "h-auto py-4 flex flex-col gap-2",
            countingMode === "direct" && "ring-2 ring-primary"
          )}
          onClick={() => onCountingModeChange("direct")}
        >
          <Calculator className="h-6 w-6" />
          <span className="font-semibold">Total Directo</span>
          <span className="text-xs opacity-70">Monto total</span>
        </Button>
      </div>

      {/* Total Card */}
      <Card className="p-6 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <span className="text-lg font-semibold">Total Contado</span>
          </div>
          <span className="text-3xl font-bold text-primary">
            ${total.toFixed(2)}
          </span>
        </div>
      </Card>

      {/* Mode Content */}
      {countingMode === "denominations" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {DENOMINATIONS.map(({ value, label }) => (
            <Card key={value} className="p-4">
              <Label htmlFor={`denom-${value}`} className="text-lg font-semibold mb-2 block">
                {label}
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id={`denom-${value}`}
                  type="number"
                  min="0"
                  value={denominations[value]}
                  onChange={(e) => handleDenominationChange(value, e.target.value)}
                  className="text-lg font-mono text-center"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  = ${(Number(value) * Number(denominations[value])).toFixed(2)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <Label htmlFor="direct-total" className="text-lg font-semibold mb-4 block">
            Ingresá el monto total de efectivo contado
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
              $
            </span>
            <Input
              id="direct-total"
              type="number"
              min="0"
              step="0.01"
              value={directInput}
              onChange={(e) => handleDirectInputChange(e.target.value)}
              className="text-3xl font-mono text-center h-16 pl-10"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3 text-center">
            Contá todos los billetes y monedas e ingresá el total
          </p>
        </Card>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button onClick={onNext} size="lg" disabled={total <= 0}>
          Continuar a Comparación
        </Button>
      </div>
    </div>
  );
}
