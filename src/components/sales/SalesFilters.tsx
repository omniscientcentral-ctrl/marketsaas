import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SalesFiltersProps {
  filters: any;
  setFilters: (filters: any) => void;
}

export function SalesFilters({ filters, setFilters }: SalesFiltersProps) {
  const { data: cashiers } = useQuery({
    queryKey: ["cashiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
      <div className="space-y-2">
        <Label>Fecha desde</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Fecha hasta</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => setFilters({ ...filters, dateTo: date })}
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Cajero</Label>
        <Select
          value={filters.cashierId}
          onValueChange={(value) => setFilters({ ...filters, cashierId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {cashiers?.map((cashier) => (
              <SelectItem key={cashier.id} value={cashier.id}>
                {cashier.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Método de pago</Label>
        <Select
          value={filters.paymentMethod}
          onValueChange={(value) => setFilters({ ...filters, paymentMethod: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
<SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
            <SelectItem value="mixed">Mixto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Estado</Label>
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters({ ...filters, status: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Anulada</SelectItem>
            <SelectItem value="returned">Devuelta</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
