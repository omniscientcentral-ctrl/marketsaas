import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Users, Package, Monitor, Building2, Bot, MessageCircle } from "lucide-react";

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  max_usuarios: number;
  max_productos: number;
  max_cajas: number;
  max_sucursales: number;
  ai_asistente: boolean;
  whatsapp_respuestas: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface PlanCardProps {
  plan: Plan;
  empresaCount: number;
  onEdit: (plan: Plan) => void;
}

const PlanCard = ({ plan, empresaCount, onEdit }: PlanCardProps) => {
  return (
    <Card className={`relative ${!plan.is_active ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.nombre}</CardTitle>
          <div className="flex items-center gap-2">
            {!plan.is_active && <Badge variant="secondary">Inactivo</Badge>}
            <Badge variant="outline">{empresaCount} empresa{empresaCount !== 1 ? "s" : ""}</Badge>
            <Button variant="ghost" size="icon" onClick={() => onEdit(plan)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {plan.descripcion && (
          <p className="text-sm text-muted-foreground">{plan.descripcion}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{plan.max_usuarios} usuarios</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{plan.max_productos.toLocaleString()} productos</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <span>{plan.max_cajas} cajas</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{plan.max_sucursales} sucursal{plan.max_sucursales !== 1 ? "es" : ""}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t">
          <Badge variant={plan.ai_asistente ? "default" : "secondary"} className="gap-1">
            <Bot className="h-3 w-3" />
            IA
          </Badge>
          <Badge variant={plan.whatsapp_respuestas ? "default" : "secondary"} className="gap-1">
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanCard;
