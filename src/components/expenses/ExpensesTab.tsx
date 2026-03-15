import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import ExpenseFilters from "./ExpenseFilters";
import ExpensesTable from "./ExpensesTable";
import ExpenseDialog from "./ExpenseDialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export interface Expense {
  id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  invoice_number: string | null;
  expense_date: string;
  notes: string | null;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
  supplier?: {
    id: string;
    name: string;
    tax_id: string | null;
  };
}

export interface Supplier {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

const ExpensesTab = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  // Totals
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching suppliers:", error);
      return;
    }
    setSuppliers(data || []);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    
    let query = supabase
      .from("expenses")
      .select(`
        *,
        supplier:suppliers(id, name, tax_id)
      `)
      .order("expense_date", { ascending: false });

    if (dateFrom) {
      query = query.gte("expense_date", dateFrom.toISOString());
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("expense_date", endOfDay.toISOString());
    }
    if (selectedSupplier) {
      query = query.eq("supplier_id", selectedSupplier);
    }
    if (selectedStatus) {
      query = query.eq("payment_status", selectedStatus);
    }
    if (selectedMethod) {
      query = query.eq("payment_method", selectedMethod);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching expenses:", error);
      toast.error("Error al cargar los gastos");
      setLoading(false);
      return;
    }

    setExpenses(data || []);
    
    // Calculate totals
    const paid = (data || [])
      .filter(e => e.payment_status === "paid")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const pending = (data || [])
      .filter(e => e.payment_status === "pending")
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    setTotalPaid(paid);
    setTotalPending(pending);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [dateFrom, dateTo, selectedSupplier, selectedStatus, selectedMethod]);

  const handleCreate = () => {
    setSelectedExpense(null);
    setDialogOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    // Delete receipt from storage if exists
    if (expense.receipt_url) {
      const path = expense.receipt_url.split("/expense-receipts/")[1];
      if (path) {
        await supabase.storage.from("expense-receipts").remove([path]);
      }
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);

    if (error) {
      console.error("Error deleting expense:", error);
      toast.error("Error al eliminar el gasto");
      return;
    }

    toast.success("Gasto eliminado");
    fetchExpenses();
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setSelectedExpense(null);
    if (refresh) {
      fetchExpenses();
    }
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedSupplier("");
    setSelectedStatus("");
    setSelectedMethod("");
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalPaid.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${totalPending.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
        <ExpenseFilters
          suppliers={suppliers}
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedSupplier={selectedSupplier}
          selectedStatus={selectedStatus}
          selectedMethod={selectedMethod}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onSupplierChange={setSelectedSupplier}
          onStatusChange={setSelectedStatus}
          onMethodChange={setSelectedMethod}
          onClearFilters={clearFilters}
        />

        <Button onClick={handleCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Expenses Table */}
      <ExpensesTable
        expenses={expenses}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Expense Dialog */}
      <ExpenseDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        expense={selectedExpense}
        suppliers={suppliers}
      />
    </div>
  );
};

export default ExpensesTab;
