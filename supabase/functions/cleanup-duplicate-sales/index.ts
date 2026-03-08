import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceRoleKey);
    const log: string[] = [];

    // Sale numbers to DELETE (the duplicate from each pair)
    const saleNumbersToDelete = [78, 130, 154, 156, 163, 174, 191, 194, 203, 215, 226, 235, 240];

    // Step 0a: Delete duplicate credit_payment for Cristian Hernandez
    const duplicatePaymentId = "c6f846bc-66c9-4538-a4ab-d21c78bb1331";
    const { data: deletedPayment, error: dpErr } = await db
      .from("credit_payments")
      .delete()
      .eq("id", duplicatePaymentId)
      .select("id");
    if (dpErr) {
      log.push(`Error eliminando pago duplicado: ${dpErr.message}`);
    } else {
      log.push(`Pago duplicado eliminado: ${deletedPayment?.length || 0} registro(s) (ID: ${duplicatePaymentId})`);
    }

    // Step 0: Get sale IDs from sale_numbers
    const { data: salesToDelete, error: fetchErr } = await db
      .from("sales")
      .select("id, sale_number, customer_id")
      .in("sale_number", saleNumbersToDelete);

    if (fetchErr) throw new Error(`Error fetching sales: ${fetchErr.message}`);
    if (!salesToDelete || salesToDelete.length === 0) {
      return new Response(JSON.stringify({ error: "No se encontraron las ventas duplicadas. ¿Ya fueron eliminadas?" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const saleIds = salesToDelete.map((s: any) => s.id);
    const foundNumbers = salesToDelete.map((s: any) => s.sale_number).sort((a: number, b: number) => a - b);
    log.push(`Ventas encontradas: ${foundNumbers.join(", ")} (${salesToDelete.length} de ${saleNumbersToDelete.length})`);

    // Collect unique customer IDs for balance recalculation
    const customerIds = [...new Set(salesToDelete.filter((s: any) => s.customer_id).map((s: any) => s.customer_id))];

    // Step 1: Get credits associated with these sales
    const { data: creditsToDelete } = await db
      .from("credits")
      .select("id, sale_id")
      .in("sale_id", saleIds);

    const creditIds = creditsToDelete?.map((c: any) => c.id) || [];
    log.push(`Créditos asociados encontrados: ${creditIds.length}`);

    // Step 2: Delete credit_payments for those credits (Monica Gervasini case + any others)
    if (creditIds.length > 0) {
      const { data: deletedPayments, error: payErr } = await db
        .from("credit_payments")
        .delete()
        .in("credit_id", creditIds)
        .select("id");
      if (payErr) throw new Error(`Error deleting credit_payments: ${payErr.message}`);
      log.push(`credit_payments eliminados: ${deletedPayments?.length || 0}`);
    }

    // Step 3: Delete credits
    if (creditIds.length > 0) {
      const { data: deletedCredits, error: credErr } = await db
        .from("credits")
        .delete()
        .in("id", creditIds)
        .select("id");
      if (credErr) throw new Error(`Error deleting credits: ${credErr.message}`);
      log.push(`credits eliminados: ${deletedCredits?.length || 0}`);
    }

    // Step 4: Nullify related_sale_id in notifications
    const { data: updatedNotifs, error: notifErr } = await db
      .from("notifications")
      .update({ related_sale_id: null })
      .in("related_sale_id", saleIds)
      .select("id");
    if (notifErr) throw new Error(`Error updating notifications: ${notifErr.message}`);
    log.push(`notifications actualizadas (related_sale_id → null): ${updatedNotifs?.length || 0}`);

    // Step 5: Delete price_override_logs referencing these sales
    const { data: deletedOverrides } = await db
      .from("price_override_logs")
      .delete()
      .in("sale_id", saleIds)
      .select("id");
    log.push(`price_override_logs eliminados: ${deletedOverrides?.length || 0}`);

    // Step 6: Delete supervisor_authorizations referencing these sales
    const { data: deletedAuths } = await db
      .from("supervisor_authorizations")
      .delete()
      .in("sale_id", saleIds)
      .select("id");
    log.push(`supervisor_authorizations eliminados: ${deletedAuths?.length || 0}`);

    // Step 7: Delete stock_override_audit referencing these sales
    const { data: deletedStockAudit } = await db
      .from("stock_override_audit")
      .delete()
      .in("sale_id", saleIds)
      .select("id");
    log.push(`stock_override_audit eliminados: ${deletedStockAudit?.length || 0}`);

    // Step 8: Delete returns referencing these sales
    const { data: deletedReturns } = await db
      .from("returns")
      .delete()
      .in("related_sale_id", saleIds)
      .select("id");
    log.push(`returns eliminados: ${deletedReturns?.length || 0}`);

    // Step 9: Delete the sales (sale_items and sale_print_audit cascade)
    const { data: deletedSales, error: saleErr } = await db
      .from("sales")
      .delete()
      .in("id", saleIds)
      .select("id, sale_number");
    if (saleErr) throw new Error(`Error deleting sales: ${saleErr.message}`);
    log.push(`ventas eliminadas: ${deletedSales?.length || 0}`);

    // Step 10: Recalculate current_balance for affected customers
    const balanceUpdates: Record<string, number> = {};
    for (const custId of customerIds) {
      const { data: activeCredits } = await db
        .from("credits")
        .select("balance")
        .eq("customer_id", custId)
        .in("status", ["pending", "partial"]);

      const newBalance = activeCredits?.reduce((sum: number, c: any) => sum + (c.balance || 0), 0) || 0;

      await db
        .from("customers")
        .update({ current_balance: newBalance })
        .eq("id", custId);

      // Get customer name for logging
      const { data: custData } = await db
        .from("customers")
        .select("name, last_name")
        .eq("id", custId)
        .single();

      const custName = custData ? `${custData.name} ${custData.last_name || ""}`.trim() : custId;
      balanceUpdates[custName] = newBalance;
    }
    log.push(`Saldos recalculados: ${JSON.stringify(balanceUpdates)}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        sales_deleted: deletedSales?.map((s: any) => s.sale_number) || [],
        credits_deleted: creditIds.length,
        customer_balances_updated: balanceUpdates,
      },
      log,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Cleanup duplicate sales error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
