import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  RotateCcw,
  PackageX,
  AlertTriangle,
  ExternalLink,
  Phone,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  DebtorCustomer,
  ReturnItem,
  CriticalStockProduct,
  ExpiringProduct,
} from "@/hooks/useDashboardData";

interface ActionableListsProps {
  debtors: DebtorCustomer[];
  returns: ReturnItem[];
  criticalStock: CriticalStockProduct[];
  expiringProducts: ExpiringProduct[];
  loading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(value);
};

const ListSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
    ))}
  </div>
);

export const ActionableLists = ({
  debtors,
  returns,
  criticalStock,
  expiringProducts,
  loading,
}: ActionableListsProps) => {
  const navigate = useNavigate();

  const getExpirationColor = (days: number) => {
    if (days <= 0) return "destructive";
    if (days <= 7) return "destructive";
    if (days <= 15) return "warning";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Acciones Recomendadas</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="debtors" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="debtors" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Deudores</span>
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-xs gap-1">
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Devoluciones</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="text-xs gap-1">
              <PackageX className="h-3 w-3" />
              <span className="hidden sm:inline">Stock</span>
            </TabsTrigger>
            <TabsTrigger value="expiring" className="text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Vencimientos</span>
            </TabsTrigger>
          </TabsList>

          {/* Debtors Tab */}
          <TabsContent value="debtors">
            <ScrollArea className="h-[350px]">
              {loading ? (
                <ListSkeleton />
              ) : debtors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Users className="h-12 w-12 mb-2 opacity-50" />
                  <p>No hay clientes con deuda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debtors.map((debtor, index) => (
                    <div
                      key={debtor.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            #{index + 1}
                          </span>
                          <p className="font-medium text-sm truncate">{debtor.name}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-destructive font-semibold text-sm">
                            {formatCurrency(debtor.currentBalance)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {formatCurrency(debtor.creditLimit)}
                          </span>
                          {debtor.currentBalance > debtor.creditLimit && (
                            <Badge variant="destructive" className="text-[10px] px-1">
                              Excedido
                            </Badge>
                          )}
                        </div>
                        {debtor.phone && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{debtor.phone}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/customers?id=${debtor.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Returns Tab */}
          <TabsContent value="returns">
            <ScrollArea className="h-[350px]">
              {loading ? (
                <ListSkeleton />
              ) : returns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <RotateCcw className="h-12 w-12 mb-2 opacity-50" />
                  <p>No hay devoluciones en el período</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {returns.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{item.productName}</p>
                        <Badge
                          variant={item.type === "Merma" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {item.type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Cant: {item.quantity}</span>
                        {item.refundAmount > 0 && (
                          <span className="text-destructive">
                            -{formatCurrency(item.refundAmount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{item.reason}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(item.createdAt), "dd/MM HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Critical Stock Tab */}
          <TabsContent value="stock">
            <ScrollArea className="h-[350px]">
              {loading ? (
                <ListSkeleton />
              ) : criticalStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <PackageX className="h-12 w-12 mb-2 opacity-50" />
                  <p>No hay productos con stock crítico</p>
                  <p className="text-xs mt-1">
                    Productos sin control de stock y alta rotación aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {criticalStock.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">
                            Stock desactivado
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {product.salesLast7Days} vendidos (7d)
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/products?id=${product.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Expiring Products Tab */}
          <TabsContent value="expiring">
            <ScrollArea className="h-[350px]">
              {loading ? (
                <ListSkeleton />
              ) : expiringProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mb-2 opacity-50" />
                  <p>No hay productos próximos a vencer</p>
                  <p className="text-xs mt-1 text-center px-4">
                    Registra lotes con fecha de vencimiento en la sección de productos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expiringProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={getExpirationColor(product.daysUntilExpiration) as any}
                            className="text-[10px]"
                          >
                            {product.daysUntilExpiration <= 0
                              ? "Vencido"
                              : `${product.daysUntilExpiration}d`}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Cant: {product.quantity}
                          </span>
                          {product.batchNumber && (
                            <span className="text-xs text-muted-foreground">
                              Lote: {product.batchNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(product.expirationDate), "dd/MM/yyyy", {
                              locale: es,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
