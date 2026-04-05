import { ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProductSearchAutocomplete from "@/components/pos/ProductSearchAutocomplete";
import { POSCartItem } from "@/components/pos/POSCartItem";
import type { CartItem, Product } from "@/hooks/usePOSTypes";

interface POSCartPanelProps {
  cart: CartItem[];
  isPOSBlocked: boolean;
  canEditPrice: boolean;
  quantityInputs: Record<string, string>;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  clearCart: () => void;
  removeFromCart: (productId: string) => void;
  onQuantityChange: (productId: string, value: string) => void;
  onQuantityCommit: (productId: string) => void;
  onPriceChange: (productId: string, newPrice: number) => Promise<void>;
}

export function POSCartPanel({
  cart,
  isPOSBlocked,
  canEditPrice,
  quantityInputs,
  addToCart,
  clearCart,
  removeFromCart,
  onQuantityChange,
  onQuantityCommit,
  onPriceChange,
}: POSCartPanelProps) {
  return (
    <div className="lg:col-span-2 space-y-6">
      {/* Search */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Búsqueda de Productos</h2>
        <ProductSearchAutocomplete onSelect={addToCart} disabled={isPOSBlocked} />
        {isPOSBlocked ? (
          <p className="text-xs text-destructive mt-2">Seleccioná una caja para comenzar a trabajar</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            Presiona F2 para buscar o escanea el código de barras
          </p>
        )}
      </Card>

      {/* Cart Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Items de Venta</h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              <Trash2 className="h-4 w-4 mr-2" />
              Vaciar
            </Button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">No hay productos en la venta</p>
            <p className="text-sm text-muted-foreground">Busca y agrega productos para comenzar</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
              <div className="col-span-5">Producto</div>
              <div className="col-span-2 text-center">Cantidad</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2 text-right">Subtotal</div>
              <div className="col-span-1"></div>
            </div>

            {cart.map((item) => (
              <POSCartItem
                key={item.product.id}
                item={item}
                canEditPrice={canEditPrice}
                quantityInput={quantityInputs[item.product.id]}
                onQuantityChange={(value) => onQuantityChange(item.product.id, value)}
                onQuantityCommit={() => onQuantityCommit(item.product.id)}
                onPriceChange={(newPrice) => onPriceChange(item.product.id, newPrice)}
                onRemove={() => removeFromCart(item.product.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
