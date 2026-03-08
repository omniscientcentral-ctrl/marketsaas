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
      return new Response(JSON.stringify({ error: "Solo administradores pueden importar productos" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const csv = body.csv as string;
    if (!csv) {
      return new Response(JSON.stringify({ error: "No se recibió contenido CSV" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = csv.split("\n");
    const db = createClient(supabaseUrl, serviceRoleKey);

    const products: { name: string; barcode: string | null; price: number; stock: number; cost: number }[] = [];
    let skipped = 0;

    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // Remove surrounding quotes if present
      if (line.startsWith('"') && line.endsWith('"')) {
        line = line.slice(1, -1);
      }
      // Also handle trailing tabs
      line = line.replace(/\t+$/, "").trim();

      // Parse from the end: price and barcode never contain commas, but name can
      const lastComma = line.lastIndexOf(",");
      if (lastComma === -1) {
        skipped++;
        continue;
      }
      const priceStr = line.substring(lastComma + 1).trim().replace(/^"|"$/g, "");
      const rest = line.substring(0, lastComma);
      const secondLastComma = rest.lastIndexOf(",");
      if (secondLastComma === -1) {
        skipped++;
        continue;
      }
      let barcode: string | null = rest.substring(secondLastComma + 1).trim().replace(/^"|"$/g, "");
      const name = rest.substring(0, secondLastComma).trim().replace(/^"|"$/g, "");

      // Skip if name is empty
      if (!name) {
        skipped++;
        continue;
      }

      // Handle NULL or empty barcodes
      if (!barcode || barcode.toUpperCase() === "NULL") {
        barcode = null;
      }

      const price = parseFloat(priceStr) || 0;

      products.push({ name, barcode, price, stock: 0, cost: 0 });
    }

    // Insert in batches of 500
    const BATCH_SIZE = 500;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const { data, error } = await db.from("products").insert(batch).select("id");
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({ inserted, skipped, total_parsed: products.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Import products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
