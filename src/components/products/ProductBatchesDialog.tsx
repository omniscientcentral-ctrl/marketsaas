import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProductBatch {
  id: string;
  batch_number: string | null;
  quantity: number;
  initial_quantity: number;
  expiration_date: string;
  received_at: string;
  cost: number;
  notes: string | null;
  status: string;
  location: string | null;
}

interface ProductBatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onBatchesUpdated?: () => void;
  onStockUpdated?: () => void;
}

export function ProductBatchesDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onBatchesUpdated,
  onStockUpdated,
}: ProductBatchesDialogProps) {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);
  const { toast } = useToast();

  // Form state
  const [quantity, setQuantity] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  
  // Dispose confirmation state
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [batchToDispose, setBatchToDispose] = useState<ProductBatch | null>(null);

  useEffect(() => {
    if (open) {
      fetchBatches();
    }
  }, [open, productId]);

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from("product_batches")
        .select("*")
        .eq("product_id", productId)
        .order("expiration_date", { ascending: true });

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los lotes",
      });
    }
  };

  const generateBatchNumber = () => {
    const date = format(new Date(), "yyyyMMdd");
    const nextNum = String(batches.length + 1).padStart(3, "0");
    return `L-${date}-${nextNum}`;
  };

  const resetForm = () => {
    setQuantity("");
    setExpirationDate("");
    setBatchNumber("");
    setCost("");
    setNotes("");
    setLocation("");
    setShowAddForm(false);
    setEditingBatch(null);
  };

  const startEditing = (batch: ProductBatch) => {
    setEditingBatch(batch);
    setQuantity(String(batch.quantity));
    setExpirationDate(batch.expiration_date);
    setBatchNumber(batch.batch_number || "");
    setCost(batch.cost ? String(batch.cost) : "");
    setNotes(batch.notes || "");
    setLocation(batch.location || "");
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBatch) {
      await handleEditBatch();
    } else {
      await handleAddBatch();
    }
  };

  const handleAddBatch = async () => {
    if (!quantity || !expirationDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cantidad y fecha de vencimiento son obligatorios",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const quantityValue = parseFloat(quantity);
      
      const { error: batchError } = await supabase.from("product_batches").insert({
        product_id: productId,
        quantity: quantityValue,
        initial_quantity: quantityValue,
        expiration_date: expirationDate,
        batch_number: batchNumber || null,
        cost: cost ? parseFloat(cost) : 0,
        notes: notes || null,
        location: location || null,
        status: "active",
        created_by: user?.id,
      });

      if (batchError) throw batchError;

      // Activar stock si estaba desactivado
      await supabase
        .from("products")
        .update({ stock_disabled: false })
        .eq("id", productId);

      // Registrar movimiento de stock (historial)
      const { data: productData } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();

      const currentStock = Math.max(0, productData?.stock || 0);

      await supabase.from("stock_movements").insert({
        product_id: productId,
        movement_type: "purchase",
        quantity: quantityValue,
        previous_stock: Math.max(0, currentStock - quantityValue),
        new_stock: currentStock,
        performed_by: user?.id,
        notes: `Recepcion de lote${batchNumber ? ` #${batchNumber}` : ""} - Vence: ${expirationDate}`,
      });

      toast({
        title: "Lote agregado",
        description: `Se agregaron ${quantityValue} unidades al stock`,
      });

      resetForm();
      fetchBatches();
      onBatchesUpdated?.();
      onStockUpdated?.();
    } catch (error: any) {
      console.error("Error adding batch:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo agregar el lote",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditBatch = async () => {
    if (!editingBatch || !quantity || !expirationDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cantidad y fecha de vencimiento son obligatorios",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newQuantity = parseFloat(quantity);
      const qtyDiff = newQuantity - editingBatch.quantity;

      // Update batch fields
      const { error: batchError } = await supabase
        .from("product_batches")
        .update({
          quantity: newQuantity,
          initial_quantity: newQuantity > editingBatch.initial_quantity ? newQuantity : editingBatch.initial_quantity,
          expiration_date: expirationDate,
          batch_number: batchNumber || null,
          cost: cost ? parseFloat(cost) : 0,
          notes: notes || null,
          location: location || null,
        })
        .eq("id", editingBatch.id);

      if (batchError) throw batchError;

      // Si cambió la cantidad, registrar movimiento (el trigger actualiza stock)
      if (qtyDiff !== 0) {
        const { data: productData } = await supabase
          .from("products")
          .select("stock")
          .eq("id", productId)
          .single();

        const currentStock = Math.max(0, productData?.stock || 0);

        await supabase.from("stock_movements").insert({
          product_id: productId,
          movement_type: "adjustment",
          quantity: Math.abs(qtyDiff),
          previous_stock: Math.max(0, currentStock - qtyDiff),
          new_stock: currentStock,
          performed_by: user?.id,
          notes: `Edición de lote${batchNumber ? ` #${batchNumber}` : ""} - Ajuste de cantidad: ${editingBatch.quantity} → ${newQuantity}`,
        });
      }

      toast({
        title: "Lote actualizado",
        description: "Los datos del lote fueron corregidos correctamente",
      });

      resetForm();
      fetchBatches();
      onBatchesUpdated?.();
      onStockUpdated?.();
    } catch (error: any) {
      console.error("Error editing batch:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el lote",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisposeBatch = async () => {
    if (!batchToDispose) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: batchError } = await supabase
        .from("product_batches")
        .update({ status: "expired", quantity: 0 })
        .eq("id", batchToDispose.id);

      if (batchError) throw batchError;

      // El trigger recalcula stock. Registrar movimiento para historial.
      const { data: productData } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();

      const currentStock = Math.max(0, productData?.stock || 0);

      await supabase.from("stock_movements").insert({
        product_id: productId,
        movement_type: "loss",
        quantity: batchToDispose.quantity,
        previous_stock: Math.max(0, currentStock + batchToDispose.quantity),
        new_stock: currentStock,
        performed_by: user?.id,
        notes: `Baja por vencimiento - Lote ${batchToDispose.batch_number || batchToDispose.id.slice(0, 8)} - Venció: ${batchToDispose.expiration_date}`,
        reason: "expired",
      });

      toast({
        title: "Lote dado de baja",
        description: `Se retiraron ${batchToDispose.quantity} unidades del stock`,
      });
      
      setDisposeDialogOpen(false);
      setBatchToDispose(null);
      fetchBatches();
      onBatchesUpdated?.();
      onStockUpdated?.();
    } catch (error: any) {
      console.error("Error disposing batch:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo dar de baja el lote",
      });
    } finally {
      setLoading(false);
    }
  };

  const getExpirationBadge = (expirationDate: string) => {
    const days = differenceInDays(parseISO(expirationDate), new Date());
    
    if (days < 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Vencido</Badge>;
    } else if (days <= 7) {
      return <Badge variant="destructive" className="gap-1">{days} días</Badge>;
    } else if (days <= 15) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 gap-1">{days} días</Badge>;
    } else if (days <= 30) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-foreground gap-1">{days} días</Badge>;
    } else {
      return <Badge variant="secondary" className="gap-1">{days} días</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Gestión de Lotes - {productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Lotes Activos</h3>
            <Button
              onClick={() => {
                resetForm();
                if (!showAddForm) {
                  setBatchNumber(generateBatchNumber());
                }
                setShowAddForm(!showAddForm);
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar Lote
            </Button>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay lotes registrados para este producto
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Lote</th>
                    <th className="text-left p-3 text-sm font-medium">Cantidad</th>
                    <th className="text-left p-3 text-sm font-medium">Vencimiento</th>
                    <th className="text-left p-3 text-sm font-medium">Ubicación</th>
                    <th className="text-left p-3 text-sm font-medium">Estado</th>
                    <th className="text-left p-3 text-sm font-medium">Recibido</th>
                    <th className="text-left p-3 text-sm font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const isExpired = differenceInDays(parseISO(batch.expiration_date), new Date()) <= 0;
                    const canDispose = isExpired && batch.quantity > 0 && batch.status === "active";
                    const canEdit = batch.status === "active" && batch.quantity > 0;
                    
                    return (
                      <tr key={batch.id} className="border-t hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          {batch.batch_number || <span className="text-muted-foreground">Sin número</span>}
                        </td>
                        <td className="p-3 text-sm font-medium">
                          {batch.quantity} / {batch.initial_quantity}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(batch.expiration_date), "dd/MM/yyyy", { locale: es })}
                          </div>
                        </td>
                        <td className="p-3">
                          {getExpirationBadge(batch.expiration_date)}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {batch.location || "—"}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {format(parseISO(batch.received_at), "dd/MM/yyyy", { locale: es })}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(batch)}
                                disabled={loading}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDispose && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setBatchToDispose(batch);
                                  setDisposeDialogOpen(true);
                                }}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Dar de Baja
                              </Button>
                            )}
                            {batch.status === "expired" && (
                              <span className="text-xs text-muted-foreground">Dado de baja</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulario para agregar/editar lote */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="font-semibold flex items-center gap-2">
                {editingBatch ? (
                  <><Pencil className="h-4 w-4" /> Editar Lote</>
                ) : (
                  <><Plus className="h-4 w-4" /> Agregar Nuevo Lote</>
                )}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ej: 50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiration">Fecha de Vencimiento *</Label>
                  <Input
                    id="expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchNumber">Número de Lote</Label>
                  <Input
                    id="batchNumber"
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="Ej: L-20260216-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ej: Estante A3, Heladera 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">Costo Unitario</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Información adicional sobre este lote..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : editingBatch ? "Guardar Cambios" : "Agregar Lote"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Dispose Confirmation Dialog */}
        <AlertDialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Confirmar Baja de Lote Vencido
              </AlertDialogTitle>
              <AlertDialogDescription>
                ¿Confirmas dar de baja <strong>{batchToDispose?.quantity}</strong> unidades 
                del lote {batchToDispose?.batch_number ? `#${batchToDispose.batch_number}` : "sin número"}?
                <br /><br />
                Esta acción restará las unidades del stock del producto y registrará un movimiento de merma por vencimiento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisposeBatch}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? "Procesando..." : "Dar de Baja"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
