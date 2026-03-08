import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface ExpirationSummary {
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
}

interface ExpirationAlertBannerProps {
  summary: ExpirationSummary | null;
  loading?: boolean;
  onViewDetails?: () => void;
}

export function ExpirationAlertBanner({ 
  summary, 
  loading = false, 
  onViewDetails 
}: ExpirationAlertBannerProps) {
  if (loading || !summary) return null;
  
  const { expiredCount, criticalCount } = summary;
  
  // Only show if there are expired or critical items
  if (expiredCount === 0 && criticalCount === 0) return null;

  const hasExpired = expiredCount > 0;
  
  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {hasExpired ? "⚠️ Productos Vencidos" : "Productos Próximos a Vencer"}
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex flex-wrap gap-3 text-sm">
          {expiredCount > 0 && (
            <span className="flex items-center gap-1 font-semibold text-destructive">
              <Clock className="h-4 w-4" />
              {expiredCount} lote{expiredCount !== 1 ? "s" : ""} vencido{expiredCount !== 1 ? "s" : ""}
            </span>
          )}
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              {criticalCount} lote{criticalCount !== 1 ? "s" : ""} por vencer en menos de 7 días
            </span>
          )}
        </div>
        {onViewDetails && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive hover:text-destructive/80"
            onClick={onViewDetails}
          >
            Ver detalles
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
