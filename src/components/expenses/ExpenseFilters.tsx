import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
}

interface ExpenseFiltersProps {
  suppliers: Supplier[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  selectedSupplier: string;
  selectedStatus: string;
  selectedMethod: string;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  onSupplierChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onClearFilters: () => void;
}

const ExpenseFilters = ({
  suppliers,
  dateFrom,
  dateTo,
  selectedSupplier,
  selectedStatus,
  selectedMethod,
  onDateFromChange,
  onDateToChange,
  onSupplierChange,
  onStatusChange,
  onMethodChange,
  onClearFilters,
}: ExpenseFiltersProps) => {
  const hasFilters = dateFrom || dateTo || selectedSupplier || selectedStatus || selectedMethod;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Date From */}
      <div className="space-y-1">
        <Label className="text-xs">Desde</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yy", { locale: es }) : "Fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date To */}
      <div className="space-y-1">
        <Label className="text-xs">Hasta</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yy", { locale: es }) : "Fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Supplier */}
      <div className="space-y-1">
        <Label className="text-xs">Proveedor</Label>
        <Select value={selectedSupplier} onValueChange={onSupplierChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <Label className="text-xs">Estado</Label>
        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Method */}
      <div className="space-y-1">
        <Label className="text-xs">Método</Label>
        <Select value={selectedMethod} onValueChange={onMethodChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="transfer">Transferencia</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={onClearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default ExpenseFilters;
