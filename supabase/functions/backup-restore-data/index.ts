import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPORT_TABLES = [
  "products",
  "customers",
  "suppliers",
  "sales",
  "sale_items",
  "stock_movements",
  "cash_registers",
  "cash_register_sessions",
  "profiles",
  "expenses",
  "credits",
  "credit_payments",
] as const;

const IMPORT_TABLES = ["products", "customers", "suppliers"] as const;

type ImportTable = (typeof IMPORT_TABLES)[number];

interface ColumnDef {
  name: string;
  required: boolean;
  type: "string" | "number" | "boolean";
}

const IMPORT_SCHEMAS: Record<ImportTable, ColumnDef[]> = {
  products: [
    { name: "name", required: true, type: "string" },
    { name: "barcode", required: false, type: "string" },
    { name: "price", required: true, type: "number" },
    { name: "stock", required: false, type: "number" },
    { name: "cost", required: false, type: "number" },
    { name: "min_stock", required: false, type: "number" },
    { name: "category", required: false, type: "string" },
    { name: "active", required: false, type: "boolean" },
    { name: "stock_disabled", required: false, type: "boolean" },
    { name: "allow_negative_stock", required: false, type: "boolean" },
  ],
  customers: [
    { name: "name", required: true, type: "string" },
    { name: "last_name", required: false, type: "string" },
    { name: "document", required: false, type: "string" },
    { name: "rut", required: false, type: "string" },
    { name: "phone", required: false, type: "string" },
    { name: "address", required: false, type: "string" },
    { name: "credit_limit", required: false, type: "number" },
    { name: "notes", required: false, type: "string" },
    { name: "status", required: false, type: "string" },
  ],
  suppliers: [
    { name: "name", required: true, type: "string" },
    { name: "phone", required: false, type: "string" },
    { name: "email", required: false, type: "string" },
    { name: "tax_id", required: false, type: "string" },
    { name: "notes", required: false, type: "string" },
    { name: "is_active", required: false, type: "boolean" },
  ],
};

function parseValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const n = Number(value);
    if (isNaN(n)) throw new Error(`"${value}" no es un número válido`);
    return n;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const s = String(value).toLowerCase();
    if (["true", "1", "si", "sí", "yes"].includes(s)) return true;
    if (["false", "0", "no"].includes(s)) return false;
    throw new Error(`"${value}" no es un booleano válido`);
  }
  return String(value);
}

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

    // Verify user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Service role client for data operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check roles
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((r: any) => r.role);
    const isSuperAdmin = userRoles.includes("super_admin");
    const isAdmin = userRoles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permisos insuficientes" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's empresa_id for admin validation
    let userEmpresaId: string | null = null;
    if (!isSuperAdmin) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      userEmpresaId = profile?.empresa_id || null;
    }

    const body = await req.json();
    const { action, empresa_id, table_name } = body;

    // Validate empresa access
    if (!isSuperAdmin && empresa_id !== userEmpresaId) {
      return new Response(
        JSON.stringify({
          error: "No tienes acceso a los datos de esta empresa",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "export") {
      if (!EXPORT_TABLES.includes(table_name)) {
        return new Response(
          JSON.stringify({ error: `Tabla "${table_name}" no permitida para exportación` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let query = adminClient.from(table_name).select("*").eq("empresa_id", empresa_id);

      // For profiles, filter by empresa_id
      if (table_name === "profiles") {
        query = adminClient
          .from("profiles")
          .select("id, full_name, email, phone, default_role, is_active, created_at")
          .eq("empresa_id", empresa_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ data: data || [], count: (data || []).length }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "import") {
      const { records, dry_run } = body;

      if (!IMPORT_TABLES.includes(table_name)) {
        return new Response(
          JSON.stringify({
            error: `Tabla "${table_name}" no permitida para importación. Solo se permiten: ${IMPORT_TABLES.join(", ")}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!Array.isArray(records) || records.length === 0) {
        return new Response(
          JSON.stringify({ error: "No se proporcionaron registros" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const schema = IMPORT_SCHEMAS[table_name as ImportTable];
      const allowedColumns = schema.map((c) => c.name);
      const requiredColumns = schema
        .filter((c) => c.required)
        .map((c) => c.name);

      const errors: { row: number; errors: string[] }[] = [];
      const validRecords: Record<string, unknown>[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowErrors: string[] = [];

        // Check required fields
        for (const col of requiredColumns) {
          if (
            record[col] === undefined ||
            record[col] === null ||
            record[col] === ""
          ) {
            rowErrors.push(`Campo requerido "${col}" está vacío`);
          }
        }

        // Build clean record with only allowed columns
        const cleanRecord: Record<string, unknown> = {
          empresa_id: empresa_id,
        };

        for (const colDef of schema) {
          if (record[colDef.name] !== undefined) {
            try {
              cleanRecord[colDef.name] = parseValue(
                record[colDef.name],
                colDef.type
              );
            } catch (e: any) {
              rowErrors.push(`Campo "${colDef.name}": ${e.message}`);
            }
          }
        }

        // Check for unknown columns
        const unknownCols = Object.keys(record).filter(
          (k) =>
            !allowedColumns.includes(k) &&
            !["id", "empresa_id", "created_at", "updated_at"].includes(k)
        );
        if (unknownCols.length > 0) {
          rowErrors.push(
            `Columnas no reconocidas: ${unknownCols.join(", ")}`
          );
        }

        if (rowErrors.length > 0) {
          errors.push({ row: i + 1, errors: rowErrors });
        } else {
          validRecords.push(cleanRecord);
        }
      }

      if (dry_run) {
        return new Response(
          JSON.stringify({
            dry_run: true,
            total: records.length,
            valid: validRecords.length,
            invalid: errors.length,
            errors,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Real import - only insert valid records
      let inserted = 0;
      const insertErrors: { row: number; error: string }[] = [];

      // Batch insert in chunks of 100
      for (let i = 0; i < validRecords.length; i += 100) {
        const batch = validRecords.slice(i, i + 100);
        const { error: insertError, data: insertData } = await adminClient
          .from(table_name)
          .insert(batch)
          .select("id");

        if (insertError) {
          insertErrors.push({
            row: i + 1,
            error: insertError.message,
          });
        } else {
          inserted += (insertData || []).length;
        }
      }

      return new Response(
        JSON.stringify({
          dry_run: false,
          total: records.length,
          inserted,
          skipped_validation: errors.length,
          validation_errors: errors,
          insert_errors: insertErrors,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "schema") {
      if (!IMPORT_TABLES.includes(table_name)) {
        return new Response(
          JSON.stringify({ error: `Tabla "${table_name}" no disponible` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ schema: IMPORT_SCHEMAS[table_name as ImportTable] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: `Acción "${action}" no reconocida` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
