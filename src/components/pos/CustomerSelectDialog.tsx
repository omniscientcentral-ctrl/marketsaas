import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, User, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Customer {
  id: string;
  name: string;
  last_name: string | null;
  document: string | null;
  phone: string | null;
  address?: string | null;
  credit_limit: number;
  current_balance: number;
  status: string;
}

interface CustomerSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}

const CustomerSelectDialog = ({ open, onClose, onSelect, onClear }: CustomerSelectDialogProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error("Error al cargar clientes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (customer: Customer) => {
    if (customer.status !== "active") {
      toast.error("Cliente bloqueado o inactivo");
      return;
    }
    onSelect(customer);
  };

  const handleClear = () => {
    onClear();
  };

  const filteredCustomers = customers.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.last_name?.toLowerCase().includes(term) ||
      `${c.name} ${c.last_name || ""}`.toLowerCase().includes(term) ||
      c.document?.includes(search) ||
      c.phone?.includes(search)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Seleccionar Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron clientes</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const available = customer.credit_limit - customer.current_balance;
                  const isOverLimit = customer.current_balance > customer.credit_limit;

                  return (
                    <Button
                      key={customer.id}
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-start hover:bg-secondary"
                      onClick={() => handleSelect(customer)}
                    >
                      <div className="flex items-start justify-between w-full mb-2">
                        <div className="text-left flex-1">
                          <p className="font-semibold">{customer.name} {customer.last_name || ""}</p>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {customer.document && <p>CI: {customer.document}</p>}
                            {customer.phone && <p>Tel: {customer.phone}</p>}
                            {customer.address && <p>Dir: {customer.address}</p>}
                          </div>
                        </div>
                        {isOverLimit && (
                          <Badge variant="destructive" className="ml-2">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            En mora
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 w-full text-xs">
                        <div>
                          <span className="text-muted-foreground">Límite:</span>
                          <p className="font-medium">${customer.credit_limit.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Deuda:</span>
                          <p className="font-medium text-warning">
                            ${customer.current_balance.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Disponible:</span>
                          <p className={`font-medium ${available < 0 ? "text-destructive" : "text-success"}`}>
                            ${available.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </Button>
                  );
                })
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
              Sin Cliente
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerSelectDialog;
