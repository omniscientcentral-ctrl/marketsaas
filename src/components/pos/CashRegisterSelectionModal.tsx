import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Clock, Lock, User, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CashRegister {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
}

interface CashSession {
  id: string;
  cash_register_id: string;
  cashier_id: string;
  opening_amount: number;
  opened_at: string;
  status: string;
  cash_registers: {
    name: string;
    location: string | null;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

interface CashRegisterSelectionModalProps {
  open: boolean;
  userId: string;
  userRole: string;
  onSessionSelected: (session: CashSession) => void;
  canClose?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CashRegisterSelectionModal({
  open,
  userId,
  userRole,
  onSessionSelected,
  canClose = false,
  onOpenChange,
}: CashRegisterSelectionModalProps) {
  const empresaId = useEmpresaId();
  const [loading, setLoading] = useState(false);
  const [mySessions, setMySessions] = useState<CashSession[]>([]);
  const [otherSessions, setOtherSessions] = useState<CashSession[]>([]);
  const [availableRegisters, setAvailableRegisters] = useState<CashRegister[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<string>("");
  const [openingAmount, setOpeningAmount] = useState<number>(0);
  const [openingNote, setOpeningNote] = useState<string>("");
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [sessionToTakeover, setSessionToTakeover] = useState<CashSession | null>(null);

  const canTakeover = userRole === "admin" || userRole === "supervisor";

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('[CashRegisterModal] Loading data for user:', userId);

      // Usar la función get_cash_registers_status que muestra todas las cajas con su estado
      const { data: registers, error: registersError } = await supabase
        .rpc('get_cash_registers_status');
      
      console.log('[CashRegisterModal] Registers status:', { registers, registersError });

      if (registersError) {
        console.error('[CashRegisterModal] Registers error:', registersError);
        throw registersError;
      }

      if (!registers || registers.length === 0) {
        toast.error('No hay cajas registradoras activas');
        setLoading(false);
        return;
      }

      // Separar las cajas según su estado
      const mine: CashSession[] = [];
      const others: CashSession[] = [];
      const available: CashRegister[] = [];

      registers.forEach((reg: any) => {
        if (reg.current_session_id) {
          // Hay una sesión abierta en esta caja
          const session: CashSession = {
            id: reg.current_session_id,
            cash_register_id: reg.cash_register_id,
            cashier_id: reg.cashier_id,
            opening_amount: reg.opening_amount || 0,
            opened_at: reg.opened_at,
            status: reg.status || 'open',
            cash_registers: {
              name: reg.cash_register_name,
              location: reg.location
            },
            profiles: {
              full_name: reg.cashier_name || 'Usuario',
              email: ''
            }
          };

          if (reg.cashier_id === userId) {
            mine.push(session);
          } else {
            others.push(session);
          }
        } else {
          // Caja disponible sin sesión abierta
          available.push({
            id: reg.cash_register_id,
            name: reg.cash_register_name,
            location: reg.location,
            is_active: reg.is_active
          });
        }
      });

      console.log('[CashRegisterModal] Separated - Mine:', mine.length, 'Others:', others.length, 'Available:', available.length);

      setMySessions(mine);
      setOtherSessions(others);
      setAvailableRegisters(available);

      // Auto-seleccionar si solo hay una opción válida
      if (mine.length === 1 && others.length === 0 && available.length === 0) {
        console.log('[CashRegisterModal] Auto-selecting single user session');
        onSessionSelected(mine[0]);
      } else if (mine.length === 0 && others.length === 0 && available.length === 1) {
        console.log('[CashRegisterModal] Auto-selecting single available register');
        setSelectedRegister(available[0].id);
        setShowOpenForm(true);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      
      if (error.code === "PGRST301" || error.message?.includes("permission")) {
        toast.error("No hay permisos de base de datos para acceder a las cajas");
      } else {
        toast.error("Error al cargar las cajas: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueSession = async (session: CashSession) => {
    try {
      // Auditar acción
      await auditAction("resume_session", session.cash_register_id, `Retomó sesión en ${session.cash_registers.name}`);
      onSessionSelected(session);
      toast.success(`Sesión retomada en ${session.cash_registers.name}`);
    } catch (error: any) {
      toast.error("Error al continuar sesión: " + error.message);
    }
  };

  const handleRequestTakeover = (session: CashSession) => {
    setSessionToTakeover(session);
    setShowTakeoverDialog(true);
  };

  const handleConfirmTakeover = async () => {
    if (!sessionToTakeover) return;

    try {
      setLoading(true);

      // Actualizar la sesión para cambiar el cashier_id
      const { error: updateError } = await supabase
        .from("cash_register")
        .update({ cashier_id: userId })
        .eq("id", sessionToTakeover.id);

      if (updateError) throw updateError;

      // Auditar acción
      await auditAction(
        "takeover_session",
        sessionToTakeover.cash_register_id,
        `Tomó posesión de sesión de ${sessionToTakeover.profiles.full_name} en ${sessionToTakeover.cash_registers.name}`
      );

      toast.success(`Sesión tomada en ${sessionToTakeover.cash_registers.name}`);
      
      // Recargar y seleccionar
      const updatedSession = { ...sessionToTakeover, cashier_id: userId };
      onSessionSelected(updatedSession);
    } catch (error: any) {
      toast.error("Error al tomar posesión: " + error.message);
    } finally {
      setLoading(false);
      setShowTakeoverDialog(false);
      setSessionToTakeover(null);
    }
  };

  const handleOpenRegister = async () => {
    if (!selectedRegister) {
      toast.error("Seleccioná una caja");
      return;
    }

    if (openingAmount < 0) {
      toast.error("El monto de apertura debe ser mayor o igual a 0");
      return;
    }

    try {
      setLoading(true);

      // Verificar que el usuario no tenga otra sesión abierta
      const { data: existingSession } = await supabase
        .from("cash_register")
        .select("id")
        .eq("cashier_id", userId)
        .eq("status", "open")
        .maybeSingle();

      if (existingSession) {
        toast.error("Ya tenés una sesión abierta. Cerrala antes de abrir otra.");
        return;
      }

      // Crear la sesión
      const { data: newSession, error: sessionError } = await supabase
        .from("cash_register")
        .insert({
          cashier_id: userId,
          cash_register_id: selectedRegister,
          opening_amount: openingAmount,
          status: "open",
          opened_at: new Date().toISOString(),
        })
        .select(`
          id,
          cash_register_id,
          cashier_id,
          opening_amount,
          opened_at,
          status,
          cash_registers!inner (name, location)
        `)
        .single();

      if (sessionError) {
        // Si el error es de constraint único (caja ya ocupada)
        if (sessionError.code === "23505" || sessionError.message?.includes("idx_unique_open_session_per_register")) {
          toast.error("Esta caja acaba de ser ocupada por otro usuario. Actualizando...");
          setShowOpenForm(false);
          setSelectedRegister("");
          setOpeningAmount(0);
          setOpeningNote("");
          // Refrescar datos automáticamente
          await loadData();
          return;
        }
        throw sessionError;
      }

      // Obtener perfil del usuario actual
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      // Agregar profile al newSession
      const sessionWithProfile: CashSession = {
        ...newSession,
        profiles: { full_name: profile?.full_name || "Usuario", email: "" }
      };

      // Obtener nombre de la caja
      const register = availableRegisters.find((r) => r.id === selectedRegister);

      // Auditar acción
      await auditAction(
        "open_session",
        selectedRegister,
        `Abrió sesión en ${register?.name || "caja"} con $${openingAmount.toFixed(2)}${openingNote ? ` - ${openingNote}` : ""}`
      );

      toast.success(`Caja ${register?.name} abierta correctamente`);
      onSessionSelected(sessionWithProfile);
    } catch (error: any) {
      console.error("Error opening register:", error);
      toast.error("Error al abrir caja: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const auditAction = async (action: string, cashRegisterId: string, details: string) => {
    try {
      await supabase.from("cash_register_audit").insert({
        cash_register_id: cashRegisterId,
        action,
        performed_by: userId,
        details: { note: details },
      });
    } catch (error) {
      console.error("Error auditing action:", error);
      // No fallar si falla la auditoría
    }
  };

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && showOpenForm && selectedRegister) {
    e.preventDefault();
    handleOpenRegister();
  } else if (e.key === "Escape" && canClose) {
    e.preventDefault();
    onOpenChange?.(false);
  }
};

const handleDialogChange = (isOpen: boolean) => {
  if (!isOpen) {
    if (canClose) {
      // Reset local state y notificar al padre para cerrar
      setShowOpenForm(false);
      setSelectedRegister("");
      setOpeningAmount(0);
      setOpeningNote("");
      onOpenChange?.(false);
    }
    // Si no puede cerrar, reabrimos inmediatamente
    else {
      onOpenChange?.(true);
    }
  }
};

if (loading && mySessions.length === 0 && otherSessions.length === 0 && availableRegisters.length === 0) {
  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => !canClose && e.preventDefault()}>
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Cargando cajas...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent 
          className="max-w-3xl max-h-[90vh] overflow-y-auto" 
          onPointerDownOutside={(e) => !canClose && e.preventDefault()}
          onKeyDown={handleKeyDown}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl">Selección de Caja</DialogTitle>
            <DialogDescription>Elegí una caja para trabajar o cerrá este diálogo si ya tenés sesión activa.</DialogDescription>
            {!canClose && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Debés seleccionar una caja para trabajar en el POS
                </AlertDescription>
              </Alert>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Mis Sesiones Abiertas */}
            {mySessions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Tus Sesiones Abiertas
                </h3>
                <div className="space-y-2">
                  {mySessions.map((session) => (
                    <Card key={session.id} className="p-4 border-green-200 bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{session.cash_registers.name}</h4>
                          {session.cash_registers.location && (
                            <p className="text-sm text-muted-foreground">{session.cash_registers.location}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Abierta: {format(new Date(session.opened_at), "HH:mm", { locale: es })}
                            </span>
                            <span>Apertura: ${session.opening_amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <Button onClick={() => handleContinueSession(session)}>
                          Continuar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Sesiones de Otros Usuarios - VISIBLE PARA TODOS */}
            {otherSessions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-orange-600" />
                  Cajas Ocupadas
                </h3>
                <div className="space-y-2">
                  {otherSessions.map((session) => (
                    <Card key={session.id} className="p-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{session.cash_registers.name}</h4>
                            <Badge variant="secondary" className="bg-orange-200 dark:bg-orange-900">
                              <User className="h-3 w-3 mr-1" />
                              Ocupada por {session.profiles.full_name || session.profiles.email}
                            </Badge>
                          </div>
                          {session.cash_registers.location && (
                            <p className="text-sm text-muted-foreground">{session.cash_registers.location}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Abierta: {format(new Date(session.opened_at), "HH:mm", { locale: es })}
                            </span>
                          </div>
                        </div>
                        {canTakeover ? (
                          <Button variant="outline" onClick={() => handleRequestTakeover(session)}>
                            Tomar Posesión
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            En uso
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
                {!canTakeover && mySessions.length === 0 && availableRegisters.length === 0 && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Todas las cajas están ocupadas. Esperá a que se libere una o contactá a un supervisor.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Cajas Disponibles para Abrir */}
            {availableRegisters.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  Cajas Disponibles
                </h3>
                
                {!showOpenForm ? (
                  <div className="space-y-2">
                    {availableRegisters.map((register) => (
                      <Card key={register.id} className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => {
                        setSelectedRegister(register.id);
                        setShowOpenForm(true);
                      }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{register.name}</h4>
                            {register.location && (
                              <p className="text-sm text-muted-foreground">{register.location}</p>
                            )}
                          </div>
                          <Button variant="outline" size="sm">
                            Abrir Caja
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <h4 className="font-medium mb-4">
                      Abrir: {availableRegisters.find((r) => r.id === selectedRegister)?.name}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="opening-amount">Monto de Apertura *</Label>
                        <Input
                          id="opening-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={openingAmount}
                          onChange={(e) => setOpeningAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label htmlFor="opening-note">Nota (opcional)</Label>
                        <Textarea
                          id="opening-note"
                          value={openingNote}
                          onChange={(e) => setOpeningNote(e.target.value)}
                          placeholder="Ej: Fondo de caja + billetes adicionales"
                          rows={2}
                        />
                      </div>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          La sesión quedará bloqueada hasta que cierres la caja
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-2">
                        <Button onClick={handleOpenRegister} disabled={loading} className="flex-1">
                          {loading ? "Abriendo..." : "Abrir Caja"}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowOpenForm(false);
                          setSelectedRegister("");
                          setOpeningAmount(0);
                          setOpeningNote("");
                        }}>
                          Cancelar
                        </Button>
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        Presiona Enter para confirmar o Esc para cancelar
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Sin Cajas Disponibles */}
            {mySessions.length === 0 && otherSessions.length === 0 && availableRegisters.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No hay cajas disponibles. 
                  {userRole === "admin" && (
                    <span> Podés crear cajas en <a href="/admin/cajas" className="underline">Gestión de Cajas</a>.</span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Toma de Posesión */}
      <AlertDialog open={showTakeoverDialog} onOpenChange={setShowTakeoverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Tomar Posesión de la Caja?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por tomar posesión de la sesión en <strong>{sessionToTakeover?.cash_registers.name}</strong> que actualmente está siendo usada por{" "}
              <strong>{sessionToTakeover?.profiles.full_name || sessionToTakeover?.profiles.email}</strong>.
              <br /><br />
              Esta acción quedará registrada en el log de auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTakeover}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
