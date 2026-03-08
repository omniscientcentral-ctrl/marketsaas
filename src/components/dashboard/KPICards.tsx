import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Receipt, TrendingUp, CreditCard, Wallet, Banknote } from "lucide-react";
import type { KPIData } from "@/hooks/useDashboardData";

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

export const KPICards = ({ data, loading }: KPICardsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const kpis = [
    {
      title: "Ventas Hoy",
      value: data?.salesToday || 0,
      subtitle: `${data?.ticketsToday || 0} tickets`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Ventas Semana",
      value: data?.salesWeek || 0,
      subtitle: `${data?.ticketsWeek || 0} tickets`,
      icon: TrendingUp,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Ventas Mes",
      value: data?.salesMonth || 0,
      subtitle: `${data?.ticketsMonth || 0} tickets`,
      icon: Receipt,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ticket Promedio",
      value: data?.averageTicket || 0,
      subtitle: "Hoy",
      icon: Banknote,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Deuda Fiado",
      value: data?.totalDebt || 0,
      subtitle: "Total adeudado",
      icon: CreditCard,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Cobros Recibidos",
      value: data?.paymentsReceived || 0,
      subtitle: "En el período",
      icon: Wallet,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                {kpi.title}
              </span>
              <div className={`p-1.5 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(kpi.value)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
