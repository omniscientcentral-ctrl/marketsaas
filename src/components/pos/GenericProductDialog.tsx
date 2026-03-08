import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PackagePlus } from "lucide-react";

interface GenericProductDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; price: number; quantity: number }) => void;
}

const GenericProductDialog = ({ open, onClose, onAdd }: GenericProductDialogProps) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPrice("");
      setQuantity("1");
      setIsSubmitting(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedPrice = parseFloat(price.replace(",", "."));
    const parsedQty = parseFloat(quantity.replace(",", "."));

    if (!name.trim()) return;
    if (isNaN(parsedPrice) || parsedPrice <= 0) return;
    if (isNaN(parsedQty) || parsedQty <= 0) return;

    setIsSubmitting(true);
    onAdd({ name: name.trim(), price: parsedPrice, quantity: parsedQty });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Producto Genérico
          </DialogTitle>
          <DialogDescription>
            Cargá un producto que no está en el sistema. No se guardará en la lista de productos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="generic-name">Descripción *</Label>
            <Input
              id="generic-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bolsa de hielo"
              maxLength={200}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="generic-price">Precio *</Label>
              <Input
                id="generic-price"
                type="number"
                min="0.01"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="generic-qty">Cantidad *</Label>
              <Input
                id="generic-qty"
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <PackagePlus className="h-4 w-4 mr-2" />
              Agregar al Carrito
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GenericProductDialog;
