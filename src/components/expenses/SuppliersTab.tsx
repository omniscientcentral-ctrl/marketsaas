import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import SuppliersTable from "./SuppliersTable";
import SupplierDialog from "./SupplierDialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export interface Supplier {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  expense_count?: number;
}

const SuppliersTab = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    
    // Get suppliers
    let suppliersQuery = supabase
      .from("suppliers")
      .select("*")
      .order("name");

    if (empresaId) {
      suppliersQuery = suppliersQuery.eq("empresa_id", empresaId);
    }

    const { data: suppliersData, error: suppliersError } = await suppliersQuery;

    if (suppliersError) {
      console.error("Error fetching suppliers:", suppliersError);
      toast.error("Error al cargar los proveedores");
      setLoading(false);
      return;
    }

    // Get expense counts per supplier
    const { data: expenseCounts, error: countsError } = await supabase
      .from("expenses")
      .select("supplier_id");

    if (countsError) {
      console.error("Error fetching expense counts:", countsError);
    }

    // Count expenses per supplier
    const countMap: Record<string, number> = {};
    (expenseCounts || []).forEach(e => {
      countMap[e.supplier_id] = (countMap[e.supplier_id] || 0) + 1;
    });

    // Merge data
    const suppliersWithCounts = (suppliersData || []).map(s => ({
      ...s,
      expense_count: countMap[s.id] || 0,
    }));

    setSuppliers(suppliersWithCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [empresaId]);

  const filteredSuppliers = suppliers.filter(s => {
    const search = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(search) ||
      (s.tax_id && s.tax_id.toLowerCase().includes(search)) ||
      (s.phone && s.phone.toLowerCase().includes(search)) ||
      (s.email && s.email.toLowerCase().includes(search))
    );
  });

  const handleCreate = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    // Check if has associated expenses
    if (supplier.expense_count && supplier.expense_count > 0) {
      toast.error(`No se puede eliminar. Este proveedor tiene ${supplier.expense_count} gasto(s) asociado(s).`);
      return;
    }

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplier.id);

    if (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Error al eliminar el proveedor");
      return;
    }

    toast.success("Proveedor eliminado");
    fetchSuppliers();
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setSelectedSupplier(null);
    if (refresh) {
      fetchSuppliers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, RUT, teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Suppliers Table */}
      <SuppliersTable
        suppliers={filteredSuppliers}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Supplier Dialog */}
      <SupplierDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        supplier={selectedSupplier}
        empresaId={empresaId}
      />
    </div>
  );
};

export default SuppliersTab;
