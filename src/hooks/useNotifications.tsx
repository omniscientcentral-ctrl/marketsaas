import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

type NotificationSeverity = 'info' | 'warn' | 'critical';

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  user_id?: string;
  actor_user_id?: string;
  actor_role?: string;
  target_type?: string;
  target_id?: string;
  related_sale_id?: string | null;
  related_customer_id?: string | null;
  metadata?: any;
}

/**
 * Hook centralizado para crear notificaciones del sistema
 */
export const useNotifications = () => {
  const { user, activeRole } = useAuth();

  // Verificar duplicados recientes (antispam)
  const checkDuplicate = async (type: string, targetId?: string): Promise<boolean> => {
    if (!targetId) return false;
    
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', type)
      .eq('target_id', targetId)
      .gte('created_at', oneMinuteAgo)
      .limit(1);
    
    return (data?.length || 0) > 0;
  };

  // Crear auditoría de notificación
  const createAudit = async (notificationId: string, action: string, details?: any) => {
    try {
      await supabase.from('notification_audit').insert({
        notification_id: notificationId,
        action,
        performed_by: user?.id,
        details
      });
    } catch (error) {
      console.error('Error creating notification audit:', error);
    }
  };

  /**
   * Notificar a un usuario específico
   */
  const notifyUser = async (userId: string, notificationData: Omit<NotificationData, 'user_id'>) => {
    try {
      // Check antispam
      if (await checkDuplicate(notificationData.type, notificationData.target_id)) {
        console.log('Duplicate notification blocked (antispam)');
        return;
      }

      const { data, error } = await supabase.from('notifications').insert([{
        user_id: userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        severity: notificationData.severity || 'info',
        actor_user_id: notificationData.actor_user_id || user?.id,
        actor_role: (notificationData.actor_role || activeRole) as 'admin' | 'cajero' | 'supervisor' | 'repositor',
        target_type: notificationData.target_type,
        target_id: notificationData.target_id,
        related_sale_id: notificationData.related_sale_id || null,
        related_customer_id: notificationData.related_customer_id || null,
        metadata: notificationData.metadata || null,
        read: false,
      }]).select().single();

      if (error) throw error;
      
      // Create audit
      if (data) {
        await createAudit(data.id, 'created', { userId });
      }

      // Show toast to actor
      if (user?.id === notificationData.actor_user_id || user?.id === userId) {
        const toastFn = notificationData.severity === 'critical' ? toast.error : 
                       notificationData.severity === 'warn' ? toast.warning : toast.success;
        toastFn(notificationData.title);
      }

      console.log(`Notificación enviada al usuario ${userId}: ${notificationData.title}`);
    } catch (error: any) {
      console.error("Error al notificar usuario:", error);
    }
  };
  
  /**
   * Notificar a todos los administradores
   */
  const notifyAdmins = async (notificationData: Omit<NotificationData, 'user_id'>) => {
    try {
      const { data: adminIds, error: rolesError } = await supabase
        .rpc("get_admin_user_ids");

      if (rolesError) throw rolesError;

      if (!adminIds || adminIds.length === 0) {
        console.warn("No hay administradores para notificar");
        return;
      }

      // Notificar a cada admin (adminIds es un array de UUIDs directamente)
      const promises = (adminIds as string[]).map((userId) => notifyUser(userId, notificationData));
      await Promise.all(promises);

      console.log(`Notificación enviada a ${adminIds.length} administradores: ${notificationData.title}`);
    } catch (error: any) {
      console.error("Error al notificar administradores:", error);
    }
  };

  /**
   * Notificar a administradores y supervisores
   */
  const notifyAdminsAndSupervisors = async (notificationData: Omit<NotificationData, 'user_id'>) => {
    try {
      const { data: userIds, error: rolesError } = await supabase
        .rpc("get_admin_and_supervisor_user_ids");

      if (rolesError) throw rolesError;

      if (!userIds || userIds.length === 0) {
        console.warn("No hay administradores ni supervisores para notificar");
        return;
      }

      // Notificar a cada rol (userIds es un array de UUIDs directamente)
      const promises = (userIds as string[]).map((userId) => notifyUser(userId, notificationData));
      await Promise.all(promises);

      console.log(`Notificación enviada a ${userIds.length} supervisores/admins: ${notificationData.title}`);
    } catch (error: any) {
      console.error("Error al notificar supervisores/admins:", error);
    }
  };

  /**
   * Notificar cierre de caja con diferencia
   */
  const notifyCashClosureWithDifference = async (data: {
    cashierName: string;
    difference: number;
    expectedAmount: number;
    countedAmount: number;
    requiresApproval: boolean;
  }) => {
    await notifyAdmins({
      type: "cash_closure_difference",
      severity: "warn",
      title: `Cierre con diferencia: ${data.cashierName}`,
      message: `Diferencia de $${Math.abs(data.difference).toFixed(2)} ${data.difference > 0 ? 'sobrante' : 'faltante'}`,
      target_type: 'cash_closure',
      metadata: {
        cashier_name: data.cashierName,
        difference: data.difference,
        expected_amount: data.expectedAmount,
        counted_amount: data.countedAmount,
        requires_approval: data.requiresApproval,
      },
    });
  };

  /**
   * Notificar cierre Z
   */
  const notifyCashClosureZ = async (data: {
    cashierName: string;
    totalSales: number;
    cashTotal: number;
    cardTotal: number;
  }) => {
    await notifyAdminsAndSupervisors({
      type: "cash_closure_z",
      severity: "info",
      title: `Cierre de caja realizado: ${data.cashierName}`,
      message: `Total ventas: $${data.totalSales.toFixed(2)}`,
      target_type: 'cash_closure',
      metadata: {
        cashier_name: data.cashierName,
        total_sales: data.totalSales,
        cash_total: data.cashTotal,
        card_total: data.cardTotal,
      },
    });
  };

  /**
   * Notificar apertura de caja
   */
  const notifyCashOpening = async (data: {
    cashierName: string;
    openingAmount: number;
    cashRegisterName: string;
  }) => {
    await notifyAdminsAndSupervisors({
      type: "cash_opening",
      severity: "info",
      title: `Apertura de caja: ${data.cashierName}`,
      message: `Caja ${data.cashRegisterName} - Monto inicial: $${data.openingAmount.toFixed(2)}`,
      target_type: 'cash_opening',
      metadata: {
        cashier_name: data.cashierName,
        opening_amount: data.openingAmount,
        cash_register_name: data.cashRegisterName,
      },
    });
  };

  /**
   * Notificar autorización de supervisor (override de stock)
   */
  const notifySupervisorOverride = async (data: {
    supervisorName: string;
    productName: string;
    quantity: number;
    reason: string;
    sale_id?: string;
  }) => {
    await notifyAdmins({
      type: "supervisor_override",
      severity: "warn",
      title: `Override autorizado: ${data.supervisorName}`,
      message: `Producto: ${data.productName} (${data.quantity} unidades)`,
      target_type: 'supervisor_override',
      related_sale_id: data.sale_id,
      metadata: {
        supervisor_name: data.supervisorName,
        product_name: data.productName,
        quantity: data.quantity,
        reason: data.reason,
      },
    });
  };

  /**
   * Notificar ajuste de inventario
   */
  const notifyInventoryAdjustment = async (data: {
    userName: string;
    productName: string;
    previousStock: number;
    newStock: number;
    reason: string;
  }) => {
    await notifyAdminsAndSupervisors({
      type: "inventory_adjustment",
      severity: "info",
      title: `Ajuste de inventario: ${data.userName}`,
      message: `${data.productName}: ${data.previousStock} → ${data.newStock}`,
      target_type: 'inventory_adjustment',
      metadata: {
        user_name: data.userName,
        product_name: data.productName,
        previous_stock: data.previousStock,
        new_stock: data.newStock,
        reason: data.reason,
      },
    });
  };

  /**
   * Notificar error crítico
   */
  const notifyCriticalError = async (data: {
    errorType: string;
    errorMessage: string;
    context?: any;
  }) => {
    await notifyAdmins({
      type: "critical_error",
      severity: "critical",
      title: `Error crítico: ${data.errorType}`,
      message: data.errorMessage,
      target_type: 'system_error',
      metadata: {
        error_type: data.errorType,
        error_message: data.errorMessage,
        context: data.context,
        timestamp: new Date().toISOString(),
      },
    });
  };

  /**
   * Notificar stock bajo
   */
  const notifyLowStock = async (data: {
    productName: string;
    currentStock: number;
    minStock: number;
  }) => {
    await notifyAdminsAndSupervisors({
      type: "low_stock",
      severity: "warn",
      title: `Stock bajo: ${data.productName}`,
      message: `Stock actual: ${data.currentStock} (mínimo: ${data.minStock})`,
      target_type: 'low_stock',
      metadata: {
        product_name: data.productName,
        current_stock: data.currentStock,
        min_stock: data.minStock,
      },
    });
  };

  // NUEVAS NOTIFICACIONES - Caja
  const notifyCashTakeover = async (cashRegisterId: string, previousUserId: string, newUserId: string, authorizedBy: string, reason: string) => {
    await notifyAdminsAndSupervisors({
      type: 'cash_takeover',
      severity: 'warn',
      title: 'Relevo de caja',
      message: `Caja transferida. Razón: ${reason}`,
      target_type: 'cash_register',
      target_id: cashRegisterId,
      metadata: { previousUserId, newUserId, authorizedBy, reason }
    });
  };

  const notifyForcedCashClosure = async (cashRegisterId: string, authorizedBy: string, reason: string) => {
    await notifyAdmins({
      type: 'forced_closure',
      severity: 'critical',
      title: 'Cierre forzado de caja',
      message: `Caja cerrada forzadamente. Razón: ${reason}`,
      target_type: 'cash_register',
      target_id: cashRegisterId,
      metadata: { authorizedBy, reason }
    });
  };

  // NUEVAS NOTIFICACIONES - Ventas
  const notifySaleCancelled = async (saleId: string, reason: string, authorizedBy?: string) => {
    await notifyAdminsAndSupervisors({
      type: 'sale_cancelled',
      severity: 'warn',
      title: 'Venta anulada',
      message: `Venta #${saleId.slice(0, 8)} anulada. Razón: ${reason}`,
      target_type: 'sale',
      target_id: saleId,
      related_sale_id: saleId,
      metadata: { reason, authorizedBy }
    });
  };

  const notifyReturnWithRefund = async (saleId: string, amount: number, productName: string) => {
    await notifyAdminsAndSupervisors({
      type: 'return_with_refund',
      severity: 'warn',
      title: 'Devolución con reintegro',
      message: `Devolución de ${productName} por $${amount}`,
      target_type: 'sale',
      target_id: saleId,
      related_sale_id: saleId,
      metadata: { amount, productName }
    });
  };

  const notifyMixedPayment = async (saleId: string, total: number, methods: string[]) => {
    await notifyAdmins({
      type: 'mixed_payment',
      severity: 'info',
      title: 'Cobro mixto',
      message: `Venta de $${total} con ${methods.join(' + ')}`,
      target_type: 'sale',
      target_id: saleId,
      related_sale_id: saleId,
      metadata: { total, methods }
    });
  };

  const notifyPendingSaleCreated = async (pendingSaleId: string, customerName?: string) => {
    await notifyUser(user?.id || '', {
      type: 'pending_sale_created',
      severity: 'info',
      title: 'Venta en espera',
      message: customerName ? `Venta guardada para ${customerName}` : 'Venta guardada',
      target_type: 'pending_sale',
      target_id: pendingSaleId,
      metadata: { customerName }
    });
  };

  // NUEVAS NOTIFICACIONES - Precios/Crédito
  const notifyPriceOverride = async (productId: string, productName: string, oldPrice: number, newPrice: number) => {
    await notifyAdminsAndSupervisors({
      type: 'price_override',
      severity: 'warn',
      title: 'Precio modificado',
      message: `${productName}: $${oldPrice} → $${newPrice}`,
      target_type: 'product',
      target_id: productId,
      metadata: { productName, oldPrice, newPrice }
    });
  };

  const notifyCreditApproved = async (customerId: string, customerName: string, amount: number) => {
    await notifyAdminsAndSupervisors({
      type: 'credit_approved',
      severity: 'info',
      title: 'Fiado aprobado',
      message: `Crédito de $${amount} aprobado para ${customerName}`,
      target_type: 'customer',
      target_id: customerId,
      related_customer_id: customerId,
      metadata: { customerName, amount }
    });
  };

  const notifyCreditDenied = async (customerId: string, customerName: string, amount: number, reason: string) => {
    await notifyAdminsAndSupervisors({
      type: 'credit_denied',
      severity: 'warn',
      title: 'Fiado denegado',
      message: `Crédito de $${amount} denegado para ${customerName}. Razón: ${reason}`,
      target_type: 'customer',
      target_id: customerId,
      related_customer_id: customerId,
      metadata: { customerName, amount, reason }
    });
  };

  const notifyDebtPayment = async (customerId: string, customerName: string, amount: number, remainingBalance: number) => {
    await notifyAdmins({
      type: 'debt_payment',
      severity: 'info',
      title: 'Pago de deuda',
      message: `${customerName} pagó $${amount}. Deuda: $${remainingBalance}`,
      target_type: 'customer',
      target_id: customerId,
      related_customer_id: customerId,
      metadata: { customerName, amount, remainingBalance }
    });
  };

  const notifyCustomerLimitExceeded = async (customerId: string, customerName: string, limit: number, attempted: number) => {
    await notifyAdminsAndSupervisors({
      type: 'credit_limit_exceeded',
      severity: 'critical',
      title: 'Límite de crédito superado',
      message: `${customerName} intentó exceder límite de $${limit} (intentó $${attempted})`,
      target_type: 'customer',
      target_id: customerId,
      related_customer_id: customerId,
      metadata: { customerName, limit, attempted }
    });
  };

  // NUEVAS NOTIFICACIONES - Stock
  const notifyStockAdjustment = async (productId: string, productName: string, oldStock: number, newStock: number, reason: string) => {
    await notifyAdminsAndSupervisors({
      type: 'stock_adjustment',
      severity: 'warn',
      title: 'Ajuste de stock',
      message: `${productName}: ${oldStock} → ${newStock}. Razón: ${reason}`,
      target_type: 'product',
      target_id: productId,
      metadata: { productName, oldStock, newStock, reason }
    });
  };

  const notifyWastage = async (productId: string, productName: string, quantity: number, reason: string) => {
    await notifyAdminsAndSupervisors({
      type: 'wastage',
      severity: 'warn',
      title: 'Merma registrada',
      message: `${productName}: ${quantity} unidades. Razón: ${reason}`,
      target_type: 'product',
      target_id: productId,
      metadata: { productName, quantity, reason }
    });
  };

  const notifyHighRotationDisabledStock = async (productId: string, productName: string, salesCount: number) => {
    await notifyAdmins({
      type: 'high_rotation_disabled_stock',
      severity: 'warn',
      title: 'Producto con alta rotación y stock desactivado',
      message: `${productName} tiene ${salesCount} ventas pero control de stock desactivado`,
      target_type: 'product',
      target_id: productId,
      metadata: { productName, salesCount }
    });
  };

  // NUEVAS NOTIFICACIONES - Sistema
  const notifySyncError = async (operation: string, details: string) => {
    await notifyAdmins({
      type: 'sync_error',
      severity: 'critical',
      title: 'Error de sincronización',
      message: `Error en ${operation}: ${details}`,
      target_type: 'system_error',
      metadata: { operation, details }
    });
  };

  const notifyOfflineMode = async () => {
    await notifyAdmins({
      type: 'offline_mode',
      severity: 'critical',
      title: 'Sistema offline',
      message: 'La aplicación está funcionando en modo offline',
      target_type: 'system_error',
      metadata: { timestamp: new Date().toISOString() }
    });
  };

  const notifyRLSError = async (table: string, operation: string, userId: string) => {
    await notifyAdmins({
      type: 'rls_error',
      severity: 'critical',
      title: 'Error de permisos',
      message: `Usuario sin permisos para ${operation} en ${table}`,
      target_type: 'system_error',
      metadata: { table, operation, userId }
    });
  };

  return {
    notifyUser,
    notifyAdmins,
    notifyAdminsAndSupervisors,
    notifyCashClosureWithDifference,
    notifyCashClosureZ,
    notifyCashOpening,
    notifySupervisorOverride,
    notifyInventoryAdjustment,
    notifyCriticalError,
    notifyLowStock,
    // Nuevas notificaciones - Caja
    notifyCashTakeover,
    notifyForcedCashClosure,
    // Nuevas notificaciones - Ventas
    notifySaleCancelled,
    notifyReturnWithRefund,
    notifyMixedPayment,
    notifyPendingSaleCreated,
    // Nuevas notificaciones - Precios/Crédito
    notifyPriceOverride,
    notifyCreditApproved,
    notifyCreditDenied,
    notifyDebtPayment,
    notifyCustomerLimitExceeded,
    // Nuevas notificaciones - Stock
    notifyStockAdjustment,
    notifyWastage,
    notifyHighRotationDisabledStock,
    // Nuevas notificaciones - Sistema
    notifySyncError,
    notifyOfflineMode,
    notifyRLSError,
  };
};
