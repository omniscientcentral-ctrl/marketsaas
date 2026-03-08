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
    const products = body.products as { barcode: string; name: string; price: number }[];
    if (!products || !Array.isArray(products)) {
      return new Response(JSON.stringify({ error: "No se recibieron productos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all existing products
    const { data: existingProducts, error: fetchError } = await db
      .from("products")
      .select("id, name, barcode, price")
      .eq("active", true);

    if (fetchError) {
      throw new Error(`Error fetching products: ${fetchError.message}`);
    }

    // Build lookup maps (lowercase name -> product)
    const byNameMap = new Map<string, any[]>();
    const byBarcodeMap = new Map<string, any>();
    for (const p of existingProducts || []) {
      const key = (p.name || "").toLowerCase().trim();
      if (!byNameMap.has(key)) byNameMap.set(key, []);
      byNameMap.get(key)!.push(p);
      if (p.barcode) {
        byBarcodeMap.set(p.barcode, p);
      }
    }

    let updated = 0;
    let inserted = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const prod of products) {
      const nameKey = (prod.name || "").toLowerCase().trim();
      const barcode = String(prod.barcode).trim();

      // Check if barcode already used by a DIFFERENT product
      const barcodeOwner = byBarcodeMap.get(barcode);
      if (barcodeOwner && barcodeOwner.name.toLowerCase().trim() !== nameKey) {
        details.push(`Barcode ${barcode} ya asignado a "${barcodeOwner.name}", no se pudo asignar a "${prod.name}"`);
        skipped++;
        continue;
      }

      // Find existing product by name
      const matches = byNameMap.get(nameKey);
      if (matches && matches.length > 0) {
        // Update first match: set barcode if missing
        const existing = matches[0];
        const updates: any = {};
        let needsUpdate = false;

        if (!existing.barcode && barcode) {
          updates.barcode = barcode;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { error: updateError } = await db
            .from("products")
            .update(updates)
            .eq("id", existing.id);

          if (updateError) {
            details.push(`Error actualizando "${prod.name}": ${updateError.message}`);
            skipped++;
          } else {
            updated++;
            details.push(`"${prod.name}" → barcode actualizado a ${barcode}`);
          }
        } else {
          skipped++;
          details.push(`"${prod.name}" ya existe con barcode ${existing.barcode || 'NULL'}, sin cambios`);
        }
      } else {
        // Insert new product
        const { error: insertError } = await db
          .from("products")
          .insert({
            name: prod.name,
            barcode: barcode || null,
            price: prod.price || 0,
            stock: 0,
            cost: 0,
          });

        if (insertError) {
          details.push(`Error insertando "${prod.name}": ${insertError.message}`);
          skipped++;
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({ updated, inserted, skipped, total: products.length, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Upsert products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
