import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EXPIRATION_THRESHOLDS } from "@/hooks/useProductExpiration";

interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string | null;
  stock: number;
  min_stock: number;
  stock_disabled?: boolean;
}

interface ProductWithExpiration extends Product {
  expiration_info?: {
    days: number;
    quantity: number;
    severity: "critical" | "warning" | "notice";
  };
  fullyExpired?: boolean;
}

interface ProductSearchAutocompleteProps {
  onSelect: (product: Product, quantity?: number) => void;
  disabled?: boolean;
}

const ProductSearchAutocomplete = ({ onSelect, disabled = false }: ProductSearchAutocompleteProps) => {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithExpiration[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchIdRef = useRef(0);
  const { toast } = useToast();

  // Auto-enfoque en el campo de búsqueda para el lector de barras
  useEffect(() => {
    // Enfocar al montar
    inputRef.current?.focus();

    // Listener para detectar entrada del lector de barras
    const handleKeyPress = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' ||
                           activeElement?.hasAttribute('contenteditable');
      
      // Si no hay ningún input activo y se presiona una tecla alfanumérica, enfocar búsqueda
      if (!isInputActive && e.key.length === 1) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setFilteredProducts([]);
      setShowResults(false);
      return;
    }

    const currentSearchId = ++searchIdRef.current;

    const timer = setTimeout(async () => {
      try {
        // Buscar primero por coincidencia exacta de barcode, luego por coincidencias parciales
        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            product_stock_balance (
              current_balance
            )
          `)
          .eq("active", true)
          .or(`barcode.eq.${q},barcode.ilike.%${q}%,name.ilike.%${q}%`)
          .order("name")
          .limit(8);

        if (error) throw error;
        if (currentSearchId !== searchIdRef.current) return;
        
        // Map products to use current_balance as stock
        const mappedData = (data || []).map(p => {
          const balanceData = Array.isArray(p.product_stock_balance) 
            ? p.product_stock_balance[0]?.current_balance 
            : p.product_stock_balance?.current_balance;
          
          return {
            ...p,
            stock: balanceData ?? 0
          };
        });

        // Fetch expiration info for each product
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const futureLimit = new Date();
        futureLimit.setDate(today.getDate() + EXPIRATION_THRESHOLDS.NOTICE);

        const productsWithExpiration = await Promise.all(
          mappedData.map(async (product) => {
            // Check if product has any active non-expired batch
            const { data: validBatch } = await supabase
              .from("product_batches")
              .select("id")
              .eq("product_id", product.id)
              .eq("status", "active")
              .gt("quantity", 0)
              .gte("expiration_date", todayStr)
              .limit(1)
              .maybeSingle();

            // Check total batch count for this product
            const { count: totalBatches } = await supabase
              .from("product_batches")
              .select("*", { count: "exact", head: true })
              .eq("product_id", product.id)
              .gt("quantity", 0);

            // If has batches but no valid ones, it's fully expired
            const fullyExpired = (totalBatches || 0) > 0 && !validBatch;

            // Get expiration info for UI (closest expiring batch with stock)
            const { data: batchData } = await supabase
              .from("product_batches")
              .select("expiration_date, quantity")
              .eq("product_id", product.id)
              .eq("status", "active")
              .gt("quantity", 0)
              .lte("expiration_date", futureLimit.toISOString())
              .order("expiration_date")
              .limit(1)
              .maybeSingle();

            let expiration_info = undefined;
            if (batchData) {
              const daysUntil = differenceInDays(parseISO(batchData.expiration_date), today);
              let severity: "critical" | "warning" | "notice" = "notice";
              if (daysUntil <= EXPIRATION_THRESHOLDS.CRITICAL) {
                severity = "critical";
              } else if (daysUntil <= EXPIRATION_THRESHOLDS.WARNING) {
                severity = "warning";
              }

              expiration_info = {
                days: daysUntil,
                quantity: batchData.quantity,
                severity,
              };
            }

            return {
              ...product,
              fullyExpired,
              expiration_info,
            };
          })
        );
        
        // Filter out fully expired products from search results
        const filteredResults = productsWithExpiration.filter(p => !p.fullyExpired);
        
        if (currentSearchId !== searchIdRef.current) return;
        setFilteredProducts(filteredResults || []);
        setShowResults(!!filteredResults && filteredResults.length > 0);
        setSelectedIndex(0);
      } catch (err: any) {
        console.error("Error searching products:", err.message);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    try {
      // Mantener como utilitario opcional (no se usa en montaje)
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name")
        .limit(50);

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error.message);
    }
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearch("");
    setFilteredProducts([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const code = search.trim();
      if (code) {
        // Intento 1: coincidencia exacta remota por código de barras (lector)
        try {
          const { data: exact, error } = await supabase
            .from("products")
            .select(`
              *,
              product_stock_balance (
                current_balance
              )
            `)
            .eq("active", true)
            .eq("barcode", code)
            .limit(1)
            .maybeSingle();

          if (exact) {
            const balanceData = Array.isArray(exact.product_stock_balance) 
              ? exact.product_stock_balance[0]?.current_balance 
              : exact.product_stock_balance?.current_balance;
            
            const mappedProduct = {
              ...exact,
              stock: balanceData ?? 0
            };
            handleSelect(mappedProduct as Product);
            return;
          }
        } catch (err: any) {
          console.error("Error exact barcode search:", err.message);
        }
      }

      // Intento 2: seleccionar el primer resultado del autocompletar
      if (showResults && filteredProducts[selectedIndex]) {
        handleSelect(filteredProducts[selectedIndex]);
        return;
      }
    }

    if (!showResults) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowResults(false);
      setSearch("");
    }
  };

  return (
    <>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="search-input"
            placeholder="Buscar por nombre o código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (search.trim().length >= 2 && filteredProducts.length > 0) setShowResults(true);
            }}
            className="pl-10 h-12 text-base"
            autoComplete="off"
            disabled={disabled}
          />
        </div>

      {showResults && search.trim().length >= 2 && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {filteredProducts.map((product, index) => {
            const isLowStock = product.stock <= product.min_stock;
            const isSelected = index === selectedIndex;

            return (
              <div
                key={product.id}
                onClick={() => handleSelect(product)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`p-4 cursor-pointer border-b last:border-b-0 transition-colors ${
                  isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="font-medium truncate">{product.name}</p>
                    </div>
                    {product.barcode && (
                      <p className="text-xs text-muted-foreground">
                        Código: {product.barcode}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-lg font-bold text-primary">
                      ${product.price.toFixed(2)}
                    </p>
                    <Badge
                      variant={product.stock < 0 ? "outline" : isLowStock ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      Stock: {product.stock}
                    </Badge>
                    {product.expiration_info && (
                      <Badge
                        variant={
                          product.expiration_info.severity === "critical"
                            ? "destructive"
                            : product.expiration_info.severity === "warning"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {product.expiration_info.days <= 0
                          ? "Vencido"
                          : `${product.expiration_info.days}d`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

        {search.length >= 2 && filteredProducts.length === 0 && (
          <div className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-lg p-4">
            <p className="text-center text-muted-foreground">
              No se encontraron productos
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={showStockAlert} onOpenChange={setShowStockAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revisar Stock
            </AlertDialogTitle>
            <AlertDialogDescription>
              El producto <strong>{selectedProduct?.name}</strong> no tiene stock disponible.
              Por favor, revise el inventario antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowStockAlert(false);
              setSelectedProduct(null);
              inputRef.current?.focus();
            }}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProductSearchAutocomplete;
