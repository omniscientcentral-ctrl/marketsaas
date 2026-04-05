import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface POSRedoBannerProps {
  saleNumber: number;
  onCancel: () => void;
}

export function POSRedoBanner({ saleNumber, onCancel }: POSRedoBannerProps) {
  return (
    <div className="bg-primary/15 border-b border-primary/30 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          Rehaciendo venta #{saleNumber} — Al cobrar se anulará la original
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="text-primary hover:text-primary"
      >
        Cancelar
      </Button>
    </div>
  );
}
