

# Reemplazar modal de pago en /customers con DebtPaymentModal del POS

## Problema
La página `/customers` tiene un modal de pago simple (solo monto, método y notas) que no coincide con el `DebtPaymentModal` usado en `/pos`, el cual muestra resumen del cliente, lista de créditos pendientes con FIFO/manual, historial de pagos, y genera comprobante automáticamente.

## Solución
Reemplazar el modal simple de pago en `src/pages/Customers.tsx` por el componente `DebtPaymentModal` que ya existe en `src/components/pos/DebtPaymentModal.tsx`.

### Cambios en `src/pages/Customers.tsx`

1. **Importar** `DebtPaymentModal` desde `@/components/pos/DebtPaymentModal`.

2. **Reemplazar** el bloque del Dialog de pago (líneas ~940-985) por:
   ```tsx
   <DebtPaymentModal
     open={paymentModalOpen}
     onClose={() => setPaymentModalOpen(false)}
     customer={selectedCustomer}
     onPaymentComplete={() => {
       fetchCustomers();
       fetchKPIs();
     }}
   />
   ```

3. **Simplificar** `openPaymentModal`: ya no necesita inicializar `paymentData`, solo setear `selectedCustomer` y abrir el modal.

4. **Eliminar** el estado `paymentData` y la función `handleRegisterPayment` que ya no se usan (la lógica completa vive dentro de `DebtPaymentModal`).

### Ajuste menor en `DebtPaymentModal`
El callback `onPaymentComplete` espera `(remainingBalance, mode)` pero desde `/customers` no necesitamos esos parámetros. El componente ya los pasa, así que en Customers simplemente los ignoramos en el callback.

### Resultado
- Misma interfaz visual y funcional en ambas vistas
- FIFO/manual, historial, comprobante automático
- Sin duplicación de lógica de pago

