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

    const db = createClient(supabaseUrl, serviceRoleKey);
    const deleted: Record<string, number> = {};

    // Get ALL product IDs with pagination (default limit is 1000)
    const allProducts: { id: string }[] = [];
    const PAGE_SIZE = 5000;
    let offset = 0;
    while (true) {
      const { data, error: fetchErr } = await db
        .from("products")
        .select("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (fetchErr) { console.error("Error fetching products:", fetchErr.message); break; }
      if (!data || data.length === 0) break;
      allProducts.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (allProducts.length === 0) {
      return new Response(
        JSON.stringify({ deleted: {}, message: "No hay productos para eliminar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Total products to delete: ${allProducts.length}`);
    const productIds = allProducts.map((p: any) => p.id);

    // Split into chunks of 500 to avoid "Bad Request" from oversized .in() queries
    const CHUNK_SIZE = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
      chunks.push(productIds.slice(i, i + CHUNK_SIZE));
    }

    // Helper for batched DELETE
    const del = async (table: string, column: string) => {
      let count = 0;
      for (const chunk of chunks) {
        const { data, error } = await db.from(table).delete().in(column, chunk).select("id");
        if (error) { console.error(`Error deleting ${table}:`, error.message); continue; }
        count += data?.length || 0;
      }
      deleted[table] = count;
    };

    // 1. Delete in FK order
    await del("stock_override_audit", "product_id");
    await del("price_override_logs", "product_id");
    await del("supervisor_authorizations", "product_id");
    await del("inventory_counts", "product_id");
    await del("product_batches", "product_id");
    await del("product_stock_balance", "product_id");
    await del("stock_movements", "product_id");

    // 2. SET NULL for sale_items and returns (preserve history)
    let updatedItemsCount = 0;
    for (const chunk of chunks) {
      const { data } = await db.from("sale_items").update({ product_id: null }).in("product_id", chunk).select("id");
      updatedItemsCount += data?.length || 0;
    }
    deleted["sale_items (SET NULL)"] = updatedItemsCount;

    let updatedReturnsCount = 0;
    for (const chunk of chunks) {
      const { data } = await db.from("returns").update({ product_id: null }).in("product_id", chunk).select("id");
      updatedReturnsCount += data?.length || 0;
    }
    deleted["returns (SET NULL)"] = updatedReturnsCount;

    // 3. Delete products
    await del("products", "id");

    return new Response(JSON.stringify({ deleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Cleanup products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
