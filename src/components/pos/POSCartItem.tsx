import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CartItem } from "@/hooks/usePOSTypes";
import { ItemPricingSettings } from "@/components/shared/ItemPricingSettings";

interface POSCartItemProps {
  item: CartItem;
  canEditPrice: boolean;
  quantityInput: string | undefined;
  onQuantityChange: (value: string) => void;
  onQuantityCommit: () => void;
  onPriceChange: (newPrice: number) => void;
  onRemove: () => void;
  onPricingChange?: (values: any) => void;
}

export function POSCartItem({
  item,
  canEditPrice,
  quantityInput,
  onQuantityChange,
  onQuantityCommit,
  onPriceChange,
  onRemove,
  onPricingChange,
}: POSCartItemProps) {
  return (
    <div className="grid grid-cols-12 gap-4 items-center py-3 border-b hover:bg-secondary/50 transition-colors">
      <div className="col-span-5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{item.product.name}</p>
          {item.product.stock_disabled ? (
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs"
            >
              Stock desactivado
            </Badge>
          ) : (
            item.product.stock - item.quantity < 0 && (
              <Badge variant="destructive" className="text-xs">
                Requiere Autorización
              </Badge>
            )
          )}
          {!item.product.stock_disabled && (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs"
            >
              Stock: {item.product.stock}
            </Badge>
          )}
          {item.expirationInfo && (
            <Badge
              variant={
                item.expirationInfo.severity === "critical"
                  ? "destructive"
                  : item.expirationInfo.severity === "warning"
                    ? "default"
                    : "secondary"
              }
              className="text-xs flex items-center gap-1"
            >
              <Clock className="h-3 w-3" />
              {item.expirationInfo.daysUntilExpiration <= 0
                ? "Vencido"
                : `${item.expirationInfo.daysUntilExpiration}d`}
            </Badge>
          )}
        </div>
        {item.product.barcode && (
          <p className="text-xs text-muted-foreground">{item.product.barcode}</p>
        )}
      </div>

      <div className="col-span-2 text-center">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={quantityInput ?? item.quantity.toString()}
          onChange={(e) => onQuantityChange(e.target.value)}
          onBlur={onQuantityCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onQuantityCommit();
            }
          }}
          className="w-16 h-8 text-center border rounded bg-background"
        />
      </div>

      <div className="col-span-2 text-right">
        {canEditPrice ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={item.product.price}
              onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-right border rounded bg-background px-2"
              title="Editar precio"
            />
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <span>${item.product.price.toFixed(2)}</span>
            <span className="text-muted-foreground" title="Sin permiso para editar precio">
              🔒
            </span>
          </div>
        )}
      </div>

      <div className="col-span-2 text-right font-medium">
        ${(item.product.price * item.quantity).toFixed(2)}
      </div>

      <div className="col-span-1 text-right">
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {canEditPrice && onPricingChange && !item.product.id.startsWith("generic-") && (
        <div className="col-span-12 mt-2 pt-2 border-t border-dashed">
          <ItemPricingSettings
            baseCost={item.product.cost || 0}
            ivaTipo={item.iva_tipo}
            utilidadPorcentaje={item.utilidad_porcentaje}
            onChange={onPricingChange}
          />
        </div>
      )}
    </div>
  );
}
