import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify caller is admin
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
      return new Response(JSON.stringify({ error: "Solo administradores pueden ejecutar esta acción" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for deletions
    const db = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Get test user IDs
    const { data: testProfiles } = await db
      .from("profiles")
      .select("id, email")
      .ilike("email", "%@soporte.com");

    if (!testProfiles || testProfiles.length === 0) {
      return new Response(
        JSON.stringify({ deleted: {}, message: "No se encontraron usuarios @soporte.com" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = testProfiles.map((p: any) => p.id);
    const deleted: Record<string, number> = {};

    // Helper
    const del = async (table: string, column: string, ids: string[]) => {
      const { data, error } = await db.from(table).delete().in(column, ids).select("id");
      if (error) console.error(`Error deleting ${table}:`, error.message);
      deleted[table] = data?.length || 0;
    };

    // Step 2: Get sale IDs for these users
    const { data: salesData } = await db.from("sales").select("id").in("cashier_id", userIds);
    const saleIds = salesData?.map((s: any) => s.id) || [];

    // Delete in FK order
    if (saleIds.length > 0) {
      // credit_payments via credits
      const { data: creditsData } = await db.from("credits").select("id").in("sale_id", saleIds);
      const creditIds = creditsData?.map((c: any) => c.id) || [];
      if (creditIds.length > 0) {
        await del("credit_payments", "credit_id", creditIds);
      } else {
        deleted["credit_payments"] = 0;
      }

      await del("credits", "sale_id", saleIds);
      await del("sale_items", "sale_id", saleIds);
      await del("price_override_logs", "sale_id", saleIds);
      await del("sale_print_audit", "sale_id", saleIds);

      // notifications related to sales
      const { data: notifData, error: notifErr } = await db
        .from("notifications")
        .delete()
        .in("related_sale_id", saleIds)
        .select("id");
      if (notifErr) console.error("Error deleting notifications:", notifErr.message);
      deleted["notifications"] = notifData?.length || 0;
    } else {
      deleted["credit_payments"] = 0;
      deleted["credits"] = 0;
      deleted["sale_items"] = 0;
      deleted["price_override_logs"] = 0;
      deleted["sale_print_audit"] = 0;
      deleted["notifications"] = 0;
    }

    // Sales
    await del("sales", "cashier_id", userIds);

    // Stock & audit
    await del("stock_movements", "performed_by", userIds);
    await del("stock_override_audit", "requested_by", userIds);
    await del("supervisor_authorizations", "authorized_by", userIds);

    // Returns
    await del("returns", "performed_by", userIds);

    // Cash register related
    await del("cash_register_expenses", "created_by", userIds);
    await del("cash_register_audit", "performed_by", userIds);

    // Takeover audit (two columns)
    const { data: takeover1 } = await db.from("cash_register_takeover_audit").delete().in("new_cashier_id", userIds).select("id");
    const { data: takeover2 } = await db.from("cash_register_takeover_audit").delete().in("previous_cashier_id", userIds).select("id");
    deleted["cash_register_takeover_audit"] = (takeover1?.length || 0) + (takeover2?.length || 0);

    await del("cash_register_sessions", "cashier_id", userIds);
    await del("cash_register", "cashier_id", userIds);
    await del("pending_sales", "cashier_id", userIds);
    await del("inventory_counts", "counted_by", userIds);
    await del("notification_audit", "performed_by", userIds);

    return new Response(JSON.stringify({ deleted, userIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
