import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Plus, Edit, Trash2, Package, Search, MinusCircle, CheckCircle2, Barcode, ChevronLeft, ChevronRight } from "lucide-react";
import { BarcodeDialog } from "@/components/products/BarcodeDialog";
import { ProductBatchesDialog } from "@/components/products/ProductBatchesDialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MainLayout from "@/components/layout/MainLayout";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  barcode: string | null;
  category: string | null;
  active: boolean;
  stock_disabled?: boolean;
}

const ITEMS_PER_PAGE = 20;

const Products = () => {
  const { user, loading, activeRole } = useAuth();
  const navigate = useNavigate();
  const empresaId = useEmpresaId();
  const { canAddProduct, counts, limits } = usePlanLimits();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [showBatchesDialog, setShowBatchesDialog] = useState(false);
  const [selectedProductForBatches, setSelectedProductForBatches] = useState<Product | null>(null);
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showDisableStockConfirm, setShowDisableStockConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    cost: "",
    stock: "",
    min_stock: "5",
    barcode: "",
    category: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (!empresaId) return;
    fetchProducts(1);
    setCurrentPage(1);
    fetchBatchCounts();
  }, [user, loading, navigate, empresaId]);

  // Auto-enfoque en el campo de búsqueda al montar y cuando se presiona cualquier tecla
  useEffect(() => {
    // Enfocar al montar el componente
    searchInputRef.current?.focus();

    // Listener para detectar entrada del lector de barras
    const handleKeyPress = (e: KeyboardEvent) => {
      // Si el diálogo está abierto o se está editando otro input, no hacer nada
      if (isDialogOpen) return;
      
      const activeElement = document.activeElement;
      const isInputActive = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' ||
                           activeElement?.hasAttribute('contenteditable');
      
      // Si no hay ningún input activo y se presiona una tecla alfanumérica, enfocar búsqueda
      if (!isInputActive && e.key.length === 1) {
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isDialogOpen]);

  // Obtiene balances de stock en chunks para evitar URLs largas (400 Bad Request)
  const fetchBalanceMap = async (ids: string[]) => {
    const map: Record<string, number> = {};
    if (!ids || ids.length === 0) return map;

    const chunkSize = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("product_stock_balance")
          .select("product_id, current_balance")
          .in("product_id", chunk)
      )
    );

    for (const res of results as any[]) {
      if (res.error) throw res.error;
      (res.data || []).forEach((b: any) => {
        map[b.product_id] = b.current_balance ?? 0;
      });
    }

    return map;
  };

  const fetchBatchCounts = async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from("product_batches")
        .select("product_id, id")
        .eq("status", "active")
        .eq("empresa_id", empresaId);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((batch) => {
        counts[batch.product_id] = (counts[batch.product_id] || 0) + 1;
      });
      setBatchCounts(counts);
    } catch (error) {
      console.error("Error fetching batch counts:", error);
    }
  };

  const fetchProducts = async (page: number = 1) => {
    if (!empresaId) return;
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Obtener conteo total
      const { count, error: countErr } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("active", true)
        .eq("empresa_id", empresaId);

      if (countErr) throw countErr;
      setTotalCount(count || 0);

      // Obtener productos paginados
      const { data: prod, error: prodErr } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("empresa_id", empresaId)
        .order("name")
        .range(from, to);

      if (prodErr) throw prodErr;

      const ids = (prod || []).map((p: any) => p.id);
      const balanceMap = await fetchBalanceMap(ids);

      setProducts(((prod || []) as any[]).map((p: any) => ({
        ...p,
        stock: balanceMap[p.id] ?? p.stock ?? 0,
      })) as Product[]);
    } catch (error: any) {
      toast.error("Error al cargar productos: " + error.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Búsqueda server-side cuando se escribe en el cuadro de búsqueda
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!empresaId) return;
        const [exactRes, partialRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("active", true)
            .eq("empresa_id", empresaId)
            .eq("barcode", term)
            .limit(10),
          supabase
            .from("products")
            .select("*")
            .eq("active", true)
            .eq("empresa_id", empresaId)
            .or(`barcode.ilike.%${term}%,name.ilike.%${term}%,category.ilike.%${term}%`)
            .order("name")
            .limit(50),
        ]);

        const list = [...(exactRes.data || []), ...(partialRes.data || [])];
        const dedup: Record<string, any> = {};
        list.forEach((p: any) => (dedup[p.id] = p));
        const resultArr = Object.values(dedup);

        const ids = resultArr.map((p: any) => p.id);
        const balanceMap = await fetchBalanceMap(ids);

        setSearchResults(resultArr.map((p: any) => ({
          ...p,
          stock: balanceMap[p.id] ?? p.stock ?? 0,
        })));

      } catch (e: any) {
        console.error("Error buscando productos:", e.message);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Genera un código EAN-13 único que no existe en la base de datos
  const generateUniqueEAN13 = async (): Promise<string> => {
    const generateEAN13Code = () => {
      // Generar 12 dígitos aleatorios
      let code = '';
      for (let i = 0; i < 12; i++) {
        code += Math.floor(Math.random() * 10);
      }
      
      // Calcular dígito de control EAN-13
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(code[i]);
        sum += i % 2 === 0 ? digit : digit * 3;
      }
      const checksum = (10 - (sum % 10)) % 10;
      
      return code + checksum;
    };

    // Intentar generar un código único
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      const code = generateEAN13Code();
      
      // Verificar si el código ya existe
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("barcode", code)
        .maybeSingle();
      
      if (error) throw error;
      
      // Si no existe, retornar el código
      if (!data) {
        return code;
      }
      
      attempts++;
    }
    
    throw new Error("No se pudo generar un código de barras único después de varios intentos");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newStock = parseInt(formData.stock);
      
      if (editingProduct) {
        // Para edición, NO actualizar stock directamente
        const productData = {
          name: formData.name,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          stock: newStock,
          min_stock: parseInt(formData.min_stock),
          barcode: formData.barcode || null,
          category: formData.category || null,
        };

        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;

        // Solo ajustar stock manualmente si NO tiene lotes activos
        const hasBatches = batchCounts[editingProduct.id] > 0;
        if (!hasBatches) {
          // Si el stock cambió, crear movimiento de inventario
          // Obtener balance actual y aplicar ajuste absoluto
          const { data: balRow, error: balErr } = await supabase
            .from("product_stock_balance")
            .select("current_balance")
            .eq("product_id", editingProduct.id)
            .maybeSingle();

          if (balErr) throw balErr;

          const currentBalance = balRow?.current_balance ?? editingProduct.stock;
          if (newStock !== currentBalance) {
            const delta = newStock - currentBalance;

            const { error: stockError } = await supabase
              .from("stock_movements")
              .insert({
                product_id: editingProduct.id,
                movement_type: "ajuste_manual",
                quantity: delta,
                previous_stock: currentBalance,
                new_stock: newStock,
                reason: `Ajuste manual desde edición de producto por ${user?.email}`,
                performed_by: user?.id,
                empresa_id: empresaId,
              });

            if (stockError) throw stockError;

            const { error: upsertErr } = await supabase
              .from("product_stock_balance")
              .upsert(
                {
                  product_id: editingProduct.id,
                  current_balance: newStock,
                  last_movement_at: new Date().toISOString(),
                },
                { onConflict: "product_id" }
              );

            if (upsertErr) throw upsertErr;
          }
        }

        toast.success("Producto actualizado");
      } else {
        // Generar código de barras único si no se proporcionó
        let barcodeToUse = formData.barcode || null;
        if (!barcodeToUse) {
          barcodeToUse = await generateUniqueEAN13();
          toast.info(`Código de barras generado: ${barcodeToUse}`);
        }

        // Para creación nueva, incluir stock inicial
        const productData = {
          name: formData.name,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          stock: newStock,
          min_stock: parseInt(formData.min_stock),
          barcode: barcodeToUse,
          category: formData.category || null,
          empresa_id: empresaId,
        };

        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();

        if (error) throw error;

        // Crear balance inicial
        await supabase.from("product_stock_balance").insert({
          product_id: newProduct.id,
          current_balance: newStock,
          last_movement_at: new Date().toISOString(),
          empresa_id: empresaId,
        });

        toast.success("Producto creado");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts(currentPage);
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      min_stock: product.min_stock.toString(),
      barcode: product.barcode || "",
      category: product.category || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Producto desactivado");
      fetchProducts(currentPage);
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      price: "",
      cost: "",
      stock: "",
      min_stock: "5",
      barcode: "",
      category: "",
    });
  };

  const filteredProducts = searchTerm.trim().length >= 2
    ? searchResults
    : products;

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const showPagination = searchTerm.trim().length < 2 && totalCount > ITEMS_PER_PAGE;
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchProducts(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  if (loading || loadingProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="px-4 py-3 md:py-4">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-4">
                <Button onClick={() => navigate("/dashboard")} variant="ghost" size="icon" className="md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg md:text-2xl font-bold">Productos</h1>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDisableStockConfirm(true)}
                >
                  Desactivar stock a todo
                </Button>
                <AlertDialog open={showDisableStockConfirm} onOpenChange={setShowDisableStockConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Desactivar control de stock?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción desactivará el control de stock para TODOS los productos activos. 
                        Los productos podrán venderse sin validar disponibilidad de inventario 
                        (permitirá stock negativo).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => {
                        const { error } = await supabase
                          .from('products')
                          .update({ stock_disabled: true })
                          .eq('active', true);
                        
                        if (error) {
                          toast.error('Error al actualizar productos');
                        } else {
                          toast.success('Control de stock desactivado para todos los productos');
                          fetchProducts(currentPage);
                        }
                        setShowDisableStockConfirm(false);
                      }}>
                        Sí, desactivar stock
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {!canAddProduct && (
                  <p className="text-xs text-destructive">
                    Límite: {counts.productos}/{limits.max_productos} productos
                  </p>
                )}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                <Button size="sm" className="h-9 md:h-10" disabled={!canAddProduct}>
                  <Plus className="mr-0 md:mr-2 h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden md:inline">Nuevo Producto</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                  </DialogTitle>
                  <DialogDescription>
                    Completa los datos del producto
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Costo *</Label>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock *</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        required
                        disabled={!!(editingProduct && batchCounts[editingProduct.id] > 0)}
                      />
                      {editingProduct && batchCounts[editingProduct.id] > 0 && (
                        <p className="text-xs text-muted-foreground">Gestionado por lotes</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_stock">Stock Mínimo *</Label>
                      <Input
                        id="min_stock"
                        type="number"
                        value={formData.min_stock}
                        onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Código de Barras</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingProduct ? "Actualizar" : "Crear"} Producto
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar por nombre, código o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8">
              {filteredProducts.length === 0 && searchTerm && (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No se encontraron productos</p>
                </div>
              )}
          
          {/* Mobile card view */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm truncate">{product.name}</h3>
                    </div>
                    {product.barcode && (
                      <p className="text-xs text-muted-foreground truncate">Cód: {product.barcode}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <Badge variant={product.stock_disabled ? "secondary" : product.stock < 10 ? "destructive" : "secondary"} className="text-xs">
                      {product.stock_disabled ? 0 : product.stock}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xl font-bold text-primary">${product.price.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => {
                      setSelectedProductForBarcode(product);
                      setBarcodeDialogOpen(true);
                    }}
                  >
                    <Barcode className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs"
                    onClick={() => handleEditProduct(product)}
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Mobile Pagination */}
          {showPagination && (
            <div className="md:hidden mt-6 space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                Mostrando {startItem}-{endItem} de {totalCount} productos
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm px-3">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Tablet/Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden lg:table-cell">Código</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Lotes</TableHead>
                  <TableHead>Stock Neg.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {product.barcode || "-"}
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      ${product.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.stock_disabled ? "secondary" : product.stock < 10 ? "destructive" : "secondary"}>
                        {product.stock_disabled ? 0 : product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProductForBatches(product);
                          setShowBatchesDialog(true);
                        }}
                        className="h-8 px-2 gap-1"
                      >
                        <Package className="h-3 w-3" />
                        <span className="text-xs">{batchCounts[product.id] || 0}</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {activeRole === 'admin' && (
                          <Switch
                            checked={product.stock_disabled || false}
                            onCheckedChange={async (checked) => {
                              try {
                                const { error } = await supabase
                                  .from("products")
                                  .update({ stock_disabled: checked })
                                  .eq("id", product.id);
                                if (error) throw error;
                                
                                // Registrar cambio en stock_movements
                                await supabase.from("stock_movements").insert({
                                  product_id: product.id,
                                  movement_type: "cambio_politica",
                                  quantity: 0,
                                  reason: `Stock ${checked ? 'desactivado' : 'activado'} por ${user?.email}`,
                                  performed_by: user?.id,
                                  empresa_id: empresaId,
                                });
                                
                                toast.success(`Stock ${checked ? 'desactivado' : 'activado'}`);
                                fetchProducts(currentPage);
                              } catch (error: any) {
                                toast.error("Error: " + error.message);
                              }
                            }}
                          />
                        )}
                        {product.stock_disabled ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs flex items-center gap-1">
                            <MinusCircle className="h-3 w-3" />
                            Stock desactivado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Stock activado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProductForBarcode(product);
                            setBarcodeDialogOpen(true);
                          }}
                        >
                          <Barcode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                        >
                          <Edit className="h-4 w-4 lg:mr-2" />
                          <span className="hidden lg:inline">Editar</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Desktop Pagination */}
            {showPagination && (
              <div className="mt-6 space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  Mostrando {startItem}-{endItem} de {totalCount} productos
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  <span className="text-sm px-4">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

      {selectedProductForBarcode && (
        <BarcodeDialog
          open={barcodeDialogOpen}
          onOpenChange={setBarcodeDialogOpen}
          product={selectedProductForBarcode}
        />
      )}

      {selectedProductForBatches && (
        <ProductBatchesDialog
          open={showBatchesDialog}
          onOpenChange={setShowBatchesDialog}
          productId={selectedProductForBatches.id}
          productName={selectedProductForBatches.name}
          onBatchesUpdated={fetchBatchCounts}
          onStockUpdated={() => fetchProducts(currentPage)}
        />
      )}
    </MainLayout>
  );
};

export default Products;
