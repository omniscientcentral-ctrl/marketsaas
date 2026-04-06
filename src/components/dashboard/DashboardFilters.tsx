import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange, DashboardFilters as Filters } from "@/hooks/useDashboardData";
import { FamilyFilter } from "./FamilyFilter";

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DashboardFilters = ({
  filters,
  onFiltersChange,
  onRefresh,
  loading,
}: DashboardFiltersProps) => {
  const handleDateRangeChange = (value: DateRange) => {
    onFiltersChange({
      ...filters,
      dateRange: value,
      customStartDate: undefined,
      customEndDate: undefined,
    });
  };

  const handleCustomDateChange = (
    field: "customStartDate" | "customEndDate",
    date: Date | undefined
  ) => {
    onFiltersChange({
      ...filters,
      dateRange: "custom",
      [field]: date,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date Range Selector */}
      <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoy</SelectItem>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {/* Family Filter */}
      <FamilyFilter
        selectedFamilyId={filters.familyId}
        onFamilyChange={(familyId) =>
          onFiltersChange({ ...filters, familyId })
        }
      />

      {/* Custom Date Range */}
      {filters.dateRange === "custom" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <CalendarIcon className="h-3 w-3" />
                {filters.customStartDate
                  ? format(filters.customStartDate, "dd/MM/yy", { locale: es })
                  : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.customStartDate}
                onSelect={(date) => handleCustomDateChange("customStartDate", date)}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">-</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <CalendarIcon className="h-3 w-3" />
                {filters.customEndDate
                  ? format(filters.customEndDate, "dd/MM/yy", { locale: es })
                  : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.customEndDate}
                onSelect={(date) => handleCustomDateChange("customEndDate", date)}
                locale={es}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Refresh Button */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Actualizar</span>
      </Button>
    </div>
  );
};
