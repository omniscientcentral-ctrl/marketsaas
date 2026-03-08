import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  DailySalesData,
  HourlySalesData,
  PaymentMethodData,
  TopProduct,
  CreditEvolutionData,
} from "@/hooks/useDashboardData";

interface SalesChartsProps {
  dailySales: DailySalesData[];
  hourlySales: HourlySalesData[];
  paymentMethods: PaymentMethodData[];
  topProducts: TopProduct[];
  creditEvolution: CreditEvolutionData[];
  loading: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const ChartSkeleton = () => (
  <div className="h-[250px] w-full flex items-center justify-center">
    <Skeleton className="h-full w-full" />
  </div>
);

export const SalesCharts = ({
  dailySales,
  hourlySales,
  paymentMethods,
  topProducts,
  creditEvolution,
  loading,
}: SalesChartsProps) => {
  const formattedDailySales = dailySales.map((d) => ({
    ...d,
    dateLabel: format(new Date(d.date), "dd MMM", { locale: es }),
  }));

  const formattedHourlySales = hourlySales.map((h) => ({
    ...h,
    hourLabel: `${h.hour}:00`,
  }));

  const formattedCreditEvolution = creditEvolution.map((c) => ({
    ...c,
    dateLabel: format(new Date(c.date), "dd MMM", { locale: es }),
  }));

  return (
    <div className="space-y-4">
      {/* Row 1: Daily Sales and Hourly Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas Últimos 30 Días</CardTitle>
            <CardDescription className="text-xs">
              Evolución diaria de ventas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : dailySales.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={formattedDailySales}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorSales)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Hourly Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por Hora</CardTitle>
            <CardDescription className="text-xs">
              Picos de actividad en el período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : hourlySales.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={formattedHourlySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "total" ? formatCurrency(value) : value,
                      name === "total" ? "Total" : "Tickets",
                    ]}
                  />
                  <Bar dataKey="tickets" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Payment Methods and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
            <CardDescription className="text-xs">
              Distribución en el período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : paymentMethods.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="total"
                    nameKey="method"
                  >
                    {paymentMethods.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 10 Productos</CardTitle>
            <CardDescription className="text-xs">Por facturación</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : topProducts.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sin datos disponibles
              </div>
            ) : (
              <Tabs defaultValue="revenue" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-2">
                  <TabsTrigger value="revenue" className="text-xs">Facturación</TabsTrigger>
                  <TabsTrigger value="quantity" className="text-xs">Cantidad</TabsTrigger>
                </TabsList>
                <TabsContent value="revenue">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        width={80}
                        tickFormatter={(v) => v.length > 12 ? `${v.slice(0, 12)}...` : v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Facturación"]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
                <TabsContent value="quantity">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        width={80}
                        tickFormatter={(v) => v.length > 12 ? `${v.slice(0, 12)}...` : v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [value, "Cantidad"]}
                      />
                      <Bar dataKey="quantity" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Credit Evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolución del Fiado</CardTitle>
          <CardDescription className="text-xs">
            Deuda generada vs pagos recibidos (últimos 30 días)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ChartSkeleton />
          ) : creditEvolution.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Sin datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={formattedCreditEvolution}>
                <defs>
                  <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="dateLabel"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "totalDebt" ? "Deuda Generada" : "Pagos Recibidos",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "totalDebt" ? "Deuda Generada" : "Pagos Recibidos"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="totalDebt"
                  stroke="hsl(var(--destructive))"
                  fillOpacity={1}
                  fill="url(#colorDebt)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="totalPayments"
                  stroke="hsl(var(--success))"
                  fillOpacity={1}
                  fill="url(#colorPayments)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
