import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, FileText, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { SalesFilters } from "@/components/sales/SalesFilters";
import { Skeleton } from "@/components/ui/skeleton";
import MainLayout from "@/components/layout/MainLayout";

const ITEMS_PER_PAGE = 20;

interface SaleFilters {
  searchTerm: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  cashRegisterId: string;
  cashierId: string;
  paymentMethod: string;
  status: string;
}

export default function Sales() {
  const navigate = useNavigate();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<SaleFilters>({
    searchTerm: "",
    dateFrom: undefined,
    dateTo: undefined,
    cashRegisterId: "all",
    cashierId: "all",
    paymentMethod: "all",
    status: "all",
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", filters, currentPage],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Build base query for count
      let countQuery = supabase
        .from("sales")
        .select("id", { count: "exact", head: true });

      // Build base query for data
      let dataQuery = supabase
        .from("sales")
        .select("id, created_at, sale_number, customer_name, cashier_id, total, payment_method, status")
        .order("created_at", { ascending: false });

      // Apply filters to both queries
      if (filters.searchTerm) {
        const isNumeric = !isNaN(Number(filters.searchTerm));
        if (isNumeric) {
          countQuery = countQuery.or(
            `sale_number.eq.${filters.searchTerm},customer_name.ilike.%${filters.searchTerm}%`
          );
          dataQuery = dataQuery.or(
            `sale_number.eq.${filters.searchTerm},customer_name.ilike.%${filters.searchTerm}%`
          );
        } else {
          countQuery = countQuery.ilike("customer_name", `%${filters.searchTerm}%`);
          dataQuery = dataQuery.ilike("customer_name", `%${filters.searchTerm}%`);
        }
      }

      if (filters.dateFrom) {
        const startDate = new Date(filters.dateFrom);
        startDate.setHours(0, 0, 0, 0);
        countQuery = countQuery.gte("created_at", startDate.toISOString());
        dataQuery = dataQuery.gte("created_at", startDate.toISOString());
      }

      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        countQuery = countQuery.lte("created_at", endDate.toISOString());
        dataQuery = dataQuery.lte("created_at", endDate.toISOString());
      }

      if (filters.cashierId && filters.cashierId !== "all") {
        countQuery = countQuery.eq("cashier_id", filters.cashierId);
        dataQuery = dataQuery.eq("cashier_id", filters.cashierId);
      }

      if (filters.paymentMethod && filters.paymentMethod !== "all") {
        countQuery = countQuery.eq("payment_method", filters.paymentMethod);
        dataQuery = dataQuery.eq("payment_method", filters.paymentMethod);
      }

      if (filters.status && filters.status !== "all") {
        countQuery = countQuery.eq("status", filters.status);
        dataQuery = dataQuery.eq("status", filters.status);
      }

      // Execute both queries
      const [countResult, dataResult] = await Promise.all([
        countQuery,
        dataQuery.range(from, to)
      ]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      return {
        sales: dataResult.data,
        totalCount: countResult.count || 0
      };
    },
  });

  const sales = data?.sales || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startItem = totalCount > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);
  const showPagination = totalCount > ITEMS_PER_PAGE;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  const { data: cashierProfiles } = useQuery({
    queryKey: ["cashier-profiles"],
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

  const cashierMap = useMemo(() => {
    const map: Record<string, string> = {};
    cashierProfiles?.forEach((p: any) => { map[p.id] = p.full_name; });
    return map;
  }, [cashierProfiles]);

  const clearFilters = () => {
    setFilters({
      searchTerm: "",
      dateFrom: undefined,
      dateTo: undefined,
      cashRegisterId: "all",
      cashierId: "all",
      paymentMethod: "all",
      status: "all",
    });
  };

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline", label: string }> = {
      cash: { variant: "default", label: "Efectivo" },
      card: { variant: "secondary", label: "Tarjeta" },
      credit: { variant: "outline", label: "Crédito" },
      mixed: { variant: "default", label: "Mixto" },
    };
    const config = variants[method] || { variant: "outline", label: method };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive", label: string }> = {
      completed: { variant: "default", label: "Completada" },
      cancelled: { variant: "destructive", label: "Anulada" },
      returned: { variant: "secondary", label: "Devuelta" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <MainLayout>
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Ventas</h1>
              <p className="text-muted-foreground">Consulta y reimprime comprobantes</p>
            </div>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de venta, cliente..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
                {(filters.dateFrom || filters.dateTo || (filters.cashierId && filters.cashierId !== "all") || (filters.paymentMethod && filters.paymentMethod !== "all") || (filters.status && filters.status !== "all")) && (
                  <Button variant="ghost" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                )}
              </div>

              {showFilters && (
                <SalesFilters filters={filters} setFilters={setFilters} />
              )}
            </div>

            <div className="mt-6">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sales && sales.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>N° Venta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Cajero</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pago</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale: any) => (
                        <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            <span className="font-mono font-semibold">#{sale.sale_number}</span>
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            {sale.customer?.name || sale.customer_name || "Mostrador"}
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            {sale.cashier?.full_name || cashierMap[sale.cashier_id] || "N/A"}
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            <span className="font-semibold">${sale.total.toFixed(2)}</span>
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            {getPaymentMethodBadge(sale.payment_method)}
                          </TableCell>
                          <TableCell onClick={() => setSelectedSaleId(sale.id)}>
                            {getStatusBadge(sale.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSaleId(sale.id);
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No hay ventas para los filtros seleccionados</p>
                </div>
              )}

              {/* Pagination */}
              {showPagination && (
                <div className="mt-6 space-y-4">
                  <div className="text-center text-sm text-muted-foreground">
                    Mostrando {startItem}-{endItem} de {totalCount} ventas
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
            </div>
          </Card>

          <SaleDetailDialog
            saleId={selectedSaleId}
            open={!!selectedSaleId}
            onClose={() => setSelectedSaleId(null)}
          />
        </div>
      </div>
    </MainLayout>
  );
}
