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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is super_admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Check super_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, empresa_id } = body;

    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "empresa_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export") {
      return await handleExport(adminClient, empresa_id);
    } else if (action === "import") {
      return await handleImport(adminClient, empresa_id, body.data, body.table_name);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleExport(client: any, empresaId: string) {
  // Get empresa info
  const { data: empresa } = await client
    .from("empresas")
    .select("id, nombre_empresa")
    .eq("id", empresaId)
    .single();

  if (!empresa) {
    return new Response(JSON.stringify({ error: "Empresa not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tables = [
    "products",
    "customers",
    "suppliers",
    "sales",
    "sale_items",
    "credits",
    "credit_payments",
    "expenses",
    "cash_registers",
    "company_settings",
    "product_batches",
  ];

  const data: Record<string, any[]> = {};

  for (const table of tables) {
    // sale_items doesn't have empresa_id directly, join via sales
    if (table === "sale_items") {
      const { data: sales } = await client
        .from("sales")
        .select("id")
        .eq("empresa_id", empresaId);
      const saleIds = (sales || []).map((s: any) => s.id);
      if (saleIds.length > 0) {
        // Fetch in batches of 100 to avoid URL length limits
        const allItems: any[] = [];
        for (let i = 0; i < saleIds.length; i += 100) {
          const batch = saleIds.slice(i, i + 100);
          const { data: items } = await client
            .from("sale_items")
            .select("*")
            .in("sale_id", batch);
          if (items) allItems.push(...items);
        }
        data[table] = allItems;
      } else {
        data[table] = [];
      }
    } else if (table === "credit_payments") {
      const { data: credits } = await client
        .from("credits")
        .select("id")
        .eq("empresa_id", empresaId);
      const creditIds = (credits || []).map((c: any) => c.id);
      if (creditIds.length > 0) {
        const allPayments: any[] = [];
        for (let i = 0; i < creditIds.length; i += 100) {
          const batch = creditIds.slice(i, i + 100);
          const { data: payments } = await client
            .from("credit_payments")
            .select("*")
            .in("credit_id", batch);
          if (payments) allPayments.push(...payments);
        }
        data[table] = allPayments;
      } else {
        data[table] = [];
      }
    } else {
      const { data: rows } = await client
        .from(table)
        .select("*")
        .eq("empresa_id", empresaId);
      data[table] = rows || [];
    }
  }

  const backup = {
    version: "1.0",
    empresa: { id: empresa.id, nombre: empresa.nombre_empresa },
    exported_at: new Date().toISOString(),
    data,
  };

  return new Response(JSON.stringify(backup), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleImport(
  client: any,
  empresaId: string,
  records: any[],
  tableName: string
) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return new Response(JSON.stringify({ error: "No records provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const importableTables = [
    "products",
    "customers",
    "suppliers",
    "cash_registers",
    "company_settings",
    "product_batches",
  ];

  if (!importableTables.includes(tableName)) {
    return new Response(
      JSON.stringify({ error: `Table '${tableName}' is not importable` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Column mappings for CSV fields to DB columns
  const columnMap: Record<string, Record<string, string>> = {
    products: {
      nombre: "name",
      codigo_barras: "barcode",
      precio: "price",
      costo: "cost",
      stock: "stock",
      categoria: "category",
      name: "name",
      barcode: "barcode",
      price: "price",
      cost: "cost",
      category: "category",
    },
    customers: {
      nombre: "name",
      apellido: "last_name",
      telefono: "phone",
      documento: "document",
      direccion: "address",
      limite_credito: "credit_limit",
      name: "name",
      last_name: "last_name",
      phone: "phone",
      document: "document",
      address: "address",
      credit_limit: "credit_limit",
      rut: "rut",
    },
    suppliers: {
      nombre: "name",
      contacto: "name",
      telefono: "phone",
      email: "email",
      direccion: "notes",
      name: "name",
      phone: "phone",
      tax_id: "tax_id",
    },
  };

  // Valid DB columns per table
  const validColumns: Record<string, string[]> = {
    products: ["name", "barcode", "price", "cost", "stock", "category", "min_stock", "active", "stock_disabled", "allow_negative_stock"],
    customers: ["name", "last_name", "phone", "document", "rut", "address", "credit_limit", "notes", "status"],
    suppliers: ["name", "phone", "email", "tax_id", "notes", "is_active"],
    cash_registers: ["name", "location", "is_active"],
    company_settings: ["company_name", "currency", "tax_id", "phone", "email", "address", "city", "receipt_footer", "logo_url", "cash_closure_approval_threshold", "modo_control_stock", "stock_disabled"],
    product_batches: ["product_id", "batch_number", "quantity", "initial_quantity", "cost", "expiration_date", "location", "notes", "status"],
  };

  const mapping = columnMap[tableName] || {};
  const allowed = validColumns[tableName] || [];

  let inserted = 0;
  let skipped = 0;
  let errors: string[] = [];

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const cleanedBatch: any[] = [];

    for (const record of batch) {
      const cleaned: Record<string, any> = { empresa_id: empresaId };

      // Remove id fields to generate new UUIDs
      for (const [key, value] of Object.entries(record)) {
        if (key === "id" || key === "empresa_id" || key === "created_at" || key === "updated_at") continue;
        const mappedKey = mapping[key.toLowerCase()] || key;
        if (allowed.includes(mappedKey)) {
          cleaned[mappedKey] = value === "" ? null : value;
        }
      }

      // Validate required fields
      if (tableName === "products" && !cleaned.name) {
        skipped++;
        continue;
      }
      if (tableName === "customers" && !cleaned.name) {
        skipped++;
        continue;
      }
      if (tableName === "suppliers" && !cleaned.name) {
        skipped++;
        continue;
      }
      if (tableName === "cash_registers" && !cleaned.name) {
        skipped++;
        continue;
      }

      // Set defaults for products
      if (tableName === "products") {
        cleaned.price = Number(cleaned.price) || 0;
        cleaned.cost = Number(cleaned.cost) || 0;
        cleaned.stock = Number(cleaned.stock) || 0;
      }

      if (tableName === "customers") {
        cleaned.credit_limit = Number(cleaned.credit_limit) || 0;
        cleaned.current_balance = 0;
      }

      cleanedBatch.push(cleaned);
    }

    if (cleanedBatch.length > 0) {
      const { error } = await client.from(tableName).insert(cleanedBatch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        skipped += cleanedBatch.length;
      } else {
        inserted += cleanedBatch.length;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      inserted,
      skipped,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
