import { useState, useEffect } from "react";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, MoreVertical, DollarSign, Users, AlertCircle, TrendingUp, Edit, Ban, History, CheckCircle, Calendar, User } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import DebtPaymentModal from "@/components/pos/DebtPaymentModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";
interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  document: string | null;
  rut: string | null;
  phone: string | null;
  address?: string | null;
  credit_limit: number;
  current_balance: number;
  status: "active" | "blocked" | "inactive";
  notes: string | null;
  updated_at: string;
}
interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  received_by: string | null;
  receiver_name: string | null;
}
interface Sale {
  id: string;
  sale_number: number;
  total: number;
  created_at: string;
  payment_method: string;
  status: string | null;
}
export default function Customers() {
  const {
    activeRole,
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // KPIs
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [overdueCust, setOverdueCust] = useState(0);
  const [paymentsToday, setPaymentsToday] = useState(0);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    last_name: "",
    document: "",
    rut: "",
    phone: "",
    address: "",
    credit_limit: 0,
    initial_debt: 0,
    notes: "",
    status: "active" as "active" | "blocked" | "inactive"
  });

  // History data
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  useEffect(() => {
    if (activeRole === "admin" || activeRole === "supervisor") {
      fetchCustomers();
      fetchKPIs();
    }
  }, [activeRole]);
  useEffect(() => {
    filterCustomers();
  }, [searchTerm, filterStatus, customers]);
  const fetchCustomers = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("customers").select("*").order("updated_at", {
        ascending: false
      });
      if (error) throw error;
      setCustomers((data || []) as Customer[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchKPIs = async () => {
    try {
      const {
        data: customers
      } = await supabase.from("customers").select("*");
      if (customers) {
        setActiveCustomers(customers.filter(c => c.status === "active").length);
        setTotalBalance(customers.reduce((sum, c) => sum + Number(c.current_balance), 0));
        setOverdueCust(customers.filter(c => Number(c.current_balance) > Number(c.credit_limit)).length);
      }
      const today = new Date().toISOString().split("T")[0];
      const {
        data: payments
      } = await supabase.from("credit_payments").select("amount").gte("created_at", today);
      if (payments) {
        setPaymentsToday(payments.reduce((sum, p) => sum + Number(p.amount), 0));
      }
    } catch (error: any) {
      console.error("Error fetching KPIs:", error);
    }
  };
  const filterCustomers = () => {
    let filtered = [...customers];
    if (searchTerm) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) || `${c.name} ${c.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) || c.document?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filterStatus !== "all") {
      if (filterStatus === "overdue") {
        filtered = filtered.filter(c => Number(c.current_balance) > 0);
      } else if (filterStatus === "no-limit") {
        filtered = filtered.filter(c => Number(c.credit_limit) === 0);
      } else {
        filtered = filtered.filter(c => c.status === filterStatus);
      }
    }
    setFilteredCustomers(filtered);
  };
  const checkDuplicates = async (excludeId?: string): Promise<string[]> => {
    const errors: string[] = [];

    // Validar documento duplicado
    if (formData.document && formData.document.trim()) {
      let query = supabase.from("customers").select("id, name, last_name").eq("document", formData.document.trim());
      if (excludeId) {
        query = query.neq("id", excludeId);
      }
      const {
        data
      } = await query.maybeSingle();
      if (data) {
        const fullName = `${data.name}${data.last_name ? ' ' + data.last_name : ''}`;
        errors.push(`El documento "${formData.document}" ya está registrado para: ${fullName}`);
      }
    }

    // Validar RUT duplicado
    if (formData.rut && formData.rut.trim()) {
      let query = supabase.from("customers").select("id, name, last_name").eq("rut", formData.rut.trim());
      if (excludeId) {
        query = query.neq("id", excludeId);
      }
      const {
        data
      } = await query.maybeSingle();
      if (data) {
        const fullName = `${data.name}${data.last_name ? ' ' + data.last_name : ''}`;
        errors.push(`El RUT "${formData.rut}" ya está registrado para: ${fullName}`);
      }
    }

    // Validar teléfono duplicado
    if (formData.phone && formData.phone.trim()) {
      let query = supabase.from("customers").select("id, name, last_name").eq("phone", formData.phone.trim());
      if (excludeId) {
        query = query.neq("id", excludeId);
      }
      const {
        data
      } = await query.maybeSingle();
      if (data) {
        const fullName = `${data.name}${data.last_name ? ' ' + data.last_name : ''}`;
        errors.push(`El teléfono "${formData.phone}" ya está registrado para: ${fullName}`);
      }
    }
    return errors;
  };
  const handleSaveCustomer = async () => {
    try {
      if (!formData.name) {
        toast({
          title: "Error",
          description: "El nombre es requerido",
          variant: "destructive"
        });
        return;
      }

      if (!formData.phone || !formData.phone.trim()) {
        toast({
          title: "Error",
          description: "El teléfono es requerido",
          variant: "destructive"
        });
        return;
      }

      // Validar longitud exacta si se ingresa documento
      if (formData.document && formData.document.trim().length > 0 && formData.document.trim().length !== 8) {
        toast({
          title: "Error",
          description: "El Documento debe tener exactamente 8 dígitos",
          variant: "destructive"
        });
        return;
      }

      // Validar longitud exacta si se ingresa RUT
      if (formData.rut && formData.rut.trim().length > 0 && formData.rut.trim().length !== 12) {
        toast({
          title: "Error",
          description: "El RUT debe tener exactamente 12 dígitos",
          variant: "destructive"
        });
        return;
      }

      // Validar teléfono mínimo 8 dígitos si se ingresa
      if (formData.phone && formData.phone.trim().length > 0 && formData.phone.trim().length < 8) {
        toast({
          title: "Error",
          description: "El Teléfono debe tener al menos 8 dígitos",
          variant: "destructive"
        });
        return;
      }

      // Validar duplicados antes de guardar
      const duplicateErrors = await checkDuplicates(selectedCustomer?.id);
      if (duplicateErrors.length > 0) {
        toast({
          title: "Datos duplicados",
          description: duplicateErrors.join(" | "),
          variant: "destructive"
        });
        return;
      }
      if (selectedCustomer) {
        // Editar cliente existente - no permitir cambiar deuda inicial
        const {
          name,
          last_name,
          document,
          rut,
          phone,
          address,
          credit_limit,
          notes,
          status
        } = formData;
        const {
          error
        } = await supabase.from("customers").update({
          name,
          last_name,
          document,
          rut,
          phone,
          address,
          credit_limit,
          notes,
          status
        }).eq("id", selectedCustomer.id);
        if (error) throw error;
        toast({
          title: "Cliente actualizado"
        });
      } else {
        // Validar usuario antes de crear
        if (formData.initial_debt && formData.initial_debt > 0 && !user?.id) {
          toast({
            title: "Error",
            description: "Sesión no válida. Por favor, recarga la página.",
            variant: "destructive"
          });
          return;
        }

        // Crear nuevo cliente con función RPC atómica
        const {
          data: newCustomerId,
          error: rpcError
        } = await (supabase.rpc as any)('create_customer_with_initial_debt', {
          p_name: formData.name,
          p_last_name: formData.last_name || null,
          p_document: formData.document || null,
          p_rut: formData.rut || null,
          p_phone: formData.phone || null,
          p_address: formData.address || null,
          p_credit_limit: formData.credit_limit || 0,
          p_initial_debt: formData.initial_debt || 0,
          p_notes: formData.notes || null,
          p_status: formData.status || 'active',
          p_cashier_id: user?.id || null,
          p_empresa_id: empresaId
        });
        if (rpcError) throw rpcError;
        toast({
          title: "Cliente creado"
        });
      }
      setEditModalOpen(false);
      resetForm();
      fetchCustomers();
      fetchKPIs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const fetchHistory = async (customerId: string) => {
    try {
      // Try with join first
      let paymentsData: any[] | null = null;
      const { data: joinData, error: joinError } = await supabase
        .from("credit_payments")
        .select("*, profiles:received_by(full_name)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (joinError) {
        console.warn("Join query failed, using fallback:", joinError.message);
        // Fallback: fetch without join
        const { data: plainData } = await supabase
          .from("credit_payments")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        paymentsData = plainData;

        // Resolve cashier names separately
        if (paymentsData && paymentsData.length > 0) {
          const receiverIds = [...new Set(paymentsData.map((p: any) => p.received_by).filter(Boolean))];
          if (receiverIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", receiverIds);
            const profileMap = new Map((profilesData || []).map((pr: any) => [pr.id, pr.full_name]));
            paymentsData = paymentsData.map((p: any) => ({
              ...p,
              profiles: p.received_by ? { full_name: profileMap.get(p.received_by) || null } : null,
            }));
          }
        }
      } else {
        paymentsData = joinData;
      }

      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      // Group payments by payment_group_id to consolidate FIFO splits
      const rawPayments = (paymentsData || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        payment_method: p.payment_method,
        notes: p.notes,
        created_at: p.created_at,
        received_by: p.received_by,
        receiver_name: p.profiles?.full_name || null,
        payment_group_id: p.payment_group_id,
      }));

      const groupedMap = new Map<string, Payment>();
      for (const p of rawPayments) {
        const key = p.payment_group_id || p.id; // fallback for old payments without group
        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)!;
          existing.amount += p.amount;
        } else {
          groupedMap.set(key, { ...p });
        }
      }
      setPayments(Array.from(groupedMap.values()));
      setSales(salesData || []);
    } catch (error: any) {
      console.error("Error fetching history:", error);
    }
  };
  const handleToggleStatus = async (customer: Customer) => {
    try {
      const newStatus = customer.status === "active" ? "blocked" : "active";
      const {
        error
      } = await supabase.from("customers").update({
        status: newStatus
      }).eq("id", customer.id);
      if (error) throw error;
      toast({
        title: `Cliente ${newStatus === "active" ? "desbloqueado" : "bloqueado"}`
      });
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const resetForm = () => {
    setFormData({
      name: "",
      last_name: "",
      document: "",
      rut: "",
      phone: "",
      address: "",
      credit_limit: 0,
      initial_debt: 0,
      notes: "",
      status: "active"
    });
    setSelectedCustomer(null);
  };
  const openEditModal = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        last_name: customer.last_name || "",
        document: customer.document || "",
        rut: customer.rut || "",
        phone: customer.phone || "",
        address: customer.address || "",
        credit_limit: customer.credit_limit,
        initial_debt: 0,
        notes: customer.notes || "",
        status: customer.status
      });
    } else {
      resetForm();
    }
    setEditModalOpen(true);
  };
  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };
  const openHistoryModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchHistory(customer.id);
    setHistoryModalOpen(true);
  };
  if (activeRole !== "admin" && activeRole !== "supervisor") {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Acceso no autorizado</p>
      </div>;
  }
  return <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with KPIs */}
        <div className="p-4 md:p-6 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Clientes</h1>
            <Button onClick={() => openEditModal()} size="sm" className="md:size-default">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Button>
          </div>

          {/* KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clientes Activos</p>
                  <p className="text-xl font-bold text-foreground">{activeCustomers}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deuda Total</p>
                  <p className="text-xl font-bold text-foreground">${totalBalance.toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Exedidos Limite</p>
                  <p className="text-xl font-bold text-foreground">{overdueCust}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagos Hoy</p>
                  <p className="text-xl font-bold text-foreground">${paymentsToday.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 md:p-6 border-b border-border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, documento o teléfono..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}>
                Todos
              </Button>
              <Button variant={filterStatus === "active" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("active")}>
                Activos
              </Button>
              <Button variant={filterStatus === "overdue" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("overdue")}>
                En Mora
              </Button>
              <Button variant={filterStatus === "blocked" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("blocked")}>
                Bloqueados
              </Button>
            </div>
          </div>
        </div>

        {/* Table / Cards */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-foreground">Nombre Completo</th>
                        <th className="text-left p-4 text-sm font-medium text-foreground">Documento</th>
                        <th className="text-left p-4 text-sm font-medium text-foreground">Teléfono</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground">Límite</th>
                        <th className="text-right p-4 text-sm font-medium text-foreground">Deuda</th>
                        <th className="text-center p-4 text-sm font-medium text-foreground">Estado</th>
                        <th className="text-center p-4 text-sm font-medium text-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map(customer => <tr key={customer.id} className="border-t border-border hover:bg-muted/50">
                          <td className="p-4 text-foreground">{customer.name} {customer.last_name || ""}</td>
                          <td className="p-4 text-muted-foreground">{customer.document || "-"}</td>
                          <td className="p-4 text-muted-foreground">{customer.phone || "-"}</td>
                          <td className="p-4 text-right text-foreground">${customer.credit_limit.toFixed(2)}</td>
                          <td className="p-4 text-right">
                            <span className={Number(customer.current_balance) > Number(customer.credit_limit) ? "text-destructive font-semibold" : "text-foreground"}>
                              ${customer.current_balance.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Badge variant={customer.status === "active" ? "default" : customer.status === "blocked" ? "destructive" : "secondary"}>
                              {customer.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditModal(customer)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPaymentModal(customer)}>
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Registrar Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openHistoryModal(customer)}>
                                  <History className="mr-2 h-4 w-4" />
                                  Historial
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                                  {customer.status === "active" ? <>
                                      <Ban className="mr-2 h-4 w-4" />
                                      Bloquear
                                    </> : <>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Desbloquear
                                    </>}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
        </div>
      </div>
              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredCustomers.map(customer => <Card key={customer.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{customer.name} {customer.last_name || ""}</h3>
                        <p className="text-sm text-muted-foreground">{customer.phone || customer.document || "Sin contacto"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPaymentModal(customer)}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Registrar Pago
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openHistoryModal(customer)}>
                            <History className="mr-2 h-4 w-4" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                            {customer.status === "active" ? <>
                                <Ban className="mr-2 h-4 w-4" />
                                Bloquear
                              </> : <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Desbloquear
                              </>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Límite:</span>
                        <span className="text-foreground font-medium">${customer.credit_limit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deuda:</span>
                        <span className={Number(customer.current_balance) > Number(customer.credit_limit) ? "text-destructive font-semibold" : "text-foreground font-medium"}>
                          ${customer.current_balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estado:</span>
                        <Badge variant={customer.status === "active" ? "default" : customer.status === "blocked" ? "destructive" : "secondary"}>
                          {customer.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>)}
              </div>
            </>}
        </div>
      </div>

      {/* Edit Customer Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({
              ...formData,
              name: e.target.value
            })} />
            </div>
            <div>
              <Label htmlFor="last_name">Apellido</Label>
              <Input id="last_name" value={formData.last_name} onChange={e => setFormData({
              ...formData,
              last_name: e.target.value
            })} />
            </div>
            <div>
              <Label htmlFor="document">Documento</Label>
              <Input 
                id="document" 
                value={formData.document} 
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setFormData({
                    ...formData,
                    document: value
                  });
                }} 
                placeholder="Ej: 12345678"
                maxLength={8}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div>
              <Label htmlFor="rut">RUT</Label>
              <Input 
                id="rut" 
                value={formData.rut} 
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setFormData({
                    ...formData,
                    rut: value
                  });
                }} 
                placeholder="Ej: 123456789012"
                maxLength={12}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono *</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setFormData({
                    ...formData,
                    phone: value
                  });
                }} 
                placeholder="Ej: 12345678"
                maxLength={15}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={formData.address} onChange={e => setFormData({
              ...formData,
              address: e.target.value
            })} placeholder="Ej: Av. Principal 123, Ciudad" />
            </div>
            <div>
              <Label htmlFor="credit_limit">Límite de Crédito</Label>
              <Input id="credit_limit" type="number" value={formData.credit_limit} onChange={e => setFormData({
              ...formData,
              credit_limit: Number(e.target.value)
            })} />
            </div>
            {!selectedCustomer && <div>
                <Label htmlFor="initial_debt">Deuda Inicial (opcional)</Label>
                <Input id="initial_debt" type="number" value={formData.initial_debt} onChange={e => setFormData({
              ...formData,
              initial_debt: Number(e.target.value)
            })} placeholder="0" />
                <p className="text-xs text-muted-foreground mt-1">
                  Registra una deuda previa del cliente
                </p>
              </div>}
            <div>
              <Label htmlFor="status">Estado</Label>
              <select id="status" value={formData.status} onChange={e => setFormData({
              ...formData,
              status: e.target.value as "active" | "blocked" | "inactive"
            })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="active">Activo</option>
                <option value="blocked">Bloqueado</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={2} value={formData.notes} onChange={e => setFormData({
              ...formData,
              notes: e.target.value
            })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCustomer}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <DebtPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        customer={selectedCustomer}
        onPaymentComplete={() => {
          fetchCustomers();
          fetchKPIs();
        }}
      />

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Historial - {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="payments">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="sales">Ventas a Crédito</TabsTrigger>
            </TabsList>
            <TabsContent value="payments" className="space-y-4 mt-4">
              {/* Resumen de pagos */}
              {payments.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 bg-success/10 border-success/20">
                    <p className="text-xs text-muted-foreground">Total Pagado</p>
                    <p className="text-lg font-bold text-success">
                      ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </p>
                  </Card>
                  <Card className="p-3 bg-primary/10 border-primary/20">
                    <p className="text-xs text-muted-foreground">Cantidad de Pagos</p>
                    <p className="text-lg font-bold text-primary">{payments.length}</p>
                  </Card>
                  <Card className="p-3 bg-warning/10 border-warning/20">
                    <p className="text-xs text-muted-foreground">Deuda Actual</p>
                    <p className="text-lg font-bold text-warning">
                      ${selectedCustomer?.current_balance.toFixed(2)}
                    </p>
                  </Card>
                </div>
              )}
              {payments.length === 0 ? <p className="text-center text-muted-foreground py-8">No hay pagos registrados</p> : payments.map(payment => {
                const methodLabel = payment.payment_method === "cash" ? "Efectivo" : payment.payment_method === "transfer" ? "Transferencia" : payment.payment_method === "card" ? "Tarjeta" : payment.payment_method;
                return (
                  <Card key={payment.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-success" />
                          <p className="text-lg font-bold text-foreground">${payment.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{methodLabel}</Badge>
                          {payment.receiver_name && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Recibido por: {payment.receiver_name}
                            </span>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-muted pl-2">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </TabsContent>
            <TabsContent value="sales" className="space-y-4 mt-4">
              {sales.length === 0 ? <p className="text-center text-muted-foreground py-8">No hay ventas a crédito</p> : sales.map(sale => {
                const statusConfig: Record<string, { label: string; className: string }> = {
                  completed: { label: "Completada", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
                  cancelled: { label: "Anulada", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
                  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
                };
                const status = sale.status || "completed";
                const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
                return (
                  <Card key={sale.id} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedSaleId(sale.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">Venta #{sale.sale_number}</p>
                          <Badge className={config.className}>{config.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">${sale.total.toFixed(2)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <SaleDetailDialog
        saleId={selectedSaleId}
        open={!!selectedSaleId}
        onClose={() => setSelectedSaleId(null)}
      />
    </MainLayout>;
}