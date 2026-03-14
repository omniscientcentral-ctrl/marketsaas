import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface CashOpenStepProps {
  openingAmount: number;
  onChange: (amount: number) => void;
  onOpen: () => void;
  selectedCashRegisterId?: string;
  onCashRegisterChange?: (id: string) => void;
}

interface CashRegister {
  id: string;
  name: string;
  location: string | null;
}

export function CashOpenStep({ 
  openingAmount, 
  onChange, 
  onOpen, 
  selectedCashRegisterId,
  onCashRegisterChange 
}: CashOpenStepProps) {
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const empresaId = useEmpresaId();

  useEffect(() => {
    loadCashRegisters();
  }, []);

  const loadCashRegisters = async () => {
    try {
      // Mostrar solo cajas activas y disponibles (sin sesión abierta)
      const { data, error } = await supabase
        .rpc('get_cash_registers_status');

      if (error) throw error;
      // Filtrar cajas sin sesión abierta (current_session_id es null)
      const available = (data || [])
        .filter((r: any) => r.is_active && !r.current_session_id)
        .map((r: any) => ({ id: r.cash_register_id, name: r.cash_register_name, location: r.location }));
      setCashRegisters(available);
      
      // Si hay solo una caja, seleccionarla automáticamente
      if (available && available.length === 1 && onCashRegisterChange) {
        onCashRegisterChange(available[0].id);
      }
    } catch (error: any) {
      toast.error("Error al cargar las cajas");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const canOpen = openingAmount >= 0 && selectedCashRegisterId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Apertura de Caja</h2>
        <p className="text-muted-foreground">
          No tienes una caja abierta. Seleccioná una caja e ingresá el monto inicial.
        </p>
      </div>

      <Card className="p-6 bg-primary/5">
        <div className="space-y-4">
          <div>
            <Label htmlFor="cash-register">Caja *</Label>
            {loading ? (
              <div className="h-10 bg-muted animate-pulse rounded" />
            ) : cashRegisters.length === 0 ? (
              <div className="text-sm text-destructive">
                No hay cajas activas. Contactá al administrador.
              </div>
            ) : (
              <Select value={selectedCashRegisterId} onValueChange={onCashRegisterChange}>
                <SelectTrigger id="cash-register">
                  <SelectValue placeholder="Seleccioná una caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashRegisters.map((register) => (
                    <SelectItem key={register.id} value={register.id}>
                      {register.name} {register.location && `- ${register.location}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Wallet className="h-6 w-6 text-primary" />
            <span className="font-semibold">Monto de Apertura</span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opening-amount">Efectivo Inicial</Label>
            <Input
              id="opening-amount"
              type="number"
              min="0"
              step="0.01"
              value={Number.isFinite(openingAmount) ? openingAmount : 0}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">Este valor se sumará al efectivo esperado del cierre.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-yellow-500/10 border-yellow-500/50">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-600">Importante</p>
            <p className="text-sm text-muted-foreground">
              Con una caja abierta, el sistema bloqueará el cierre de sesión hasta completar el cierre (cierre Z).
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={onOpen} disabled={!canOpen}>
          Abrir Caja
        </Button>
      </div>
    </div>
  );
}
