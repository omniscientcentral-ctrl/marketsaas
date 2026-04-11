import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type IvaTipo = "incluido" | "exento" | "minimo" | "normal";

export interface PricingValues {
  ivaTipo: IvaTipo;
  ivaPorcentaje: number;
  utilidadPorcentaje: number;
  costoConIva: number;
  precioFinal: number;
}

interface ItemPricingSettingsProps {
  baseCost: number;
  ivaTipo: IvaTipo;
  utilidadPorcentaje: number;
  onChange: (values: PricingValues) => void;
  className?: string;
  readOnly?: boolean;
}

export function calculatePricing(baseCost: number, ivaTipo: IvaTipo, utilidad: number): PricingValues {
  let ivaPorcentaje = 0;
  if (ivaTipo === "minimo") ivaPorcentaje = 10;
  else if (ivaTipo === "normal") ivaPorcentaje = 22;

  const costoConIva = baseCost * (1 + ivaPorcentaje / 100);
  const precioFinal = costoConIva * (1 + utilidad / 100);

  return {
    ivaTipo,
    ivaPorcentaje,
    utilidadPorcentaje: utilidad,
    costoConIva: Number(costoConIva.toFixed(2)),
    precioFinal: Number(precioFinal.toFixed(2))
  };
}

export function ItemPricingSettings({
  baseCost,
  ivaTipo,
  utilidadPorcentaje,
  onChange,
  className = "",
  readOnly = false
}: ItemPricingSettingsProps) {
  
  const currentPricing = calculatePricing(baseCost, ivaTipo, utilidadPorcentaje);

  return (
    <div className={`grid grid-cols-4 gap-2 items-end ${className}`}>
      <div className="space-y-1">
        <Label className="text-[10px]">Tipo IVA</Label>
        <Select 
          value={ivaTipo} 
          onValueChange={(val: IvaTipo) => {
            onChange(calculatePricing(baseCost, val, utilidadPorcentaje));
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="incluido" className="text-xs">Incluido (0%)</SelectItem>
            <SelectItem value="exento" className="text-xs">Exento (0%)</SelectItem>
            <SelectItem value="minimo" className="text-xs">Mínimo (10%)</SelectItem>
            <SelectItem value="normal" className="text-xs">Normal (22%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Utilidad (%)</Label>
        <Input 
          type="number" 
          className="h-8 text-xs"
          value={utilidadPorcentaje}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 0;
            onChange(calculatePricing(baseCost, ivaTipo, val));
          }}
          readOnly={readOnly}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground p-0 leading-none">Costo c/IVA</Label>
        <Input 
          className="h-8 bg-muted text-xs" 
          value={currentPricing.costoConIva} 
          readOnly 
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground p-0 leading-none">P. Final</Label>
        <Input 
          className="h-8 bg-muted font-bold text-xs" 
          value={currentPricing.precioFinal} 
          readOnly 
        />
      </div>
    </div>
  );
}
