import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

interface BarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    barcode: string | null;
    price: number;
  };
}

export const BarcodeDialog = ({ open, onOpenChange, product }: BarcodeDialogProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ean13Code, setEan13Code] = useState<string>("");

  useEffect(() => {
    if (open && product) {
      // Generar código EAN-13
      let code = product.barcode || "";
      
      // Si el código no tiene 13 dígitos, generar uno basado en el ID del producto
      if (!/^\d{13}$/.test(code)) {
        // Usar los últimos dígitos del ID + timestamp para generar código único
        const productIdNum = product.id.replace(/\D/g, '').slice(-6).padStart(6, '0');
        const timestamp = Date.now().toString().slice(-6);
        code = productIdNum + timestamp;
        
        // Asegurar que tenga 12 dígitos (el último es checksum)
        code = code.slice(0, 12);
        
        // Calcular dígito de control EAN-13
        let sum = 0;
        for (let i = 0; i < 12; i++) {
          const digit = parseInt(code[i]);
          sum += i % 2 === 0 ? digit : digit * 3;
        }
        const checksum = (10 - (sum % 10)) % 10;
        code = code + checksum;
      }

      setEan13Code(code);

      // Generar código de barras en SVG después de que el componente se monte
      const timer = setTimeout(() => {
        if (svgRef.current) {
          try {
            // Limpiar SVG existente
            while (svgRef.current.firstChild) {
              svgRef.current.removeChild(svgRef.current.firstChild);
            }
            
            // Generar nuevo código de barras
            JsBarcode(svgRef.current, code, {
              format: "EAN13",
              width: 2,
              height: 100,
              displayValue: true,
              fontSize: 16,
              margin: 10,
              background: "#ffffff",
              lineColor: "#000000",
            });
          } catch (error) {
            console.error("Error generando código de barras:", error);
          }
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [open, product]);

  const handlePrint = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    
    // Crear ventana de impresión
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta - ${product.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
            }
            .label {
              width: 60mm;
              height: 40mm;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            .product-name {
              font-size: 8pt;
              font-weight: bold;
              margin-bottom: 1mm;
              color: #000;
              max-height: 6mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              margin: 1mm 0;
            }
            .barcode-wrapper svg {
              max-width: 55mm;
              height: auto;
            }
            @page {
              size: 60mm 40mm;
              margin: 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="product-name">${product.name}</div>
            <div class="barcode-wrapper">
              ${svgData}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Código de Barras EAN-13</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">{product.name}</p>
            <p className="text-lg font-bold mt-1">${product.price.toFixed(2)}</p>
          </div>
          
          <div className="flex justify-center items-center p-4 bg-background border rounded-lg">
            <svg ref={svgRef} />
          </div>

          <div className="text-xs text-center text-muted-foreground">
            Código: {ean13Code}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
