import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PYMO_BASE_URL = "https://gateway.pymo.com.uy";
const PYMO_VERSION = "v1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sale_id } = await req.json();
    if (!sale_id) return errorResponse("sale_id requerido", 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Traer venta + items + empresa + cliente
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select(`
        *,
        sale_items(*),
        empresas:empresa_id(
          id, nombre_empresa, rut, razon_social,
          domicilio_fiscal, ciudad_fiscal,
          pymo_rut, pymo_email, pymo_password_enc
        ),
        customers:customer_id(
          id, name, rut, tipo_doc_recep,
          cod_pais_recep, rzn_soc, dir_recep,
          ciudad_recep, depto_recep
        )
      `)
      .eq("id", sale_id)
      .single();

    if (saleErr || !sale) return errorResponse("Venta no encontrada", 404);

    const empresa = sale.empresas;
    const cliente = sale.customers;

    if (!empresa.pymo_email || !empresa.pymo_password_enc) {
      return errorResponse("Empresa sin credenciales PYMO configuradas", 400);
    }

    // 2. Login PYMO — token por 1 hora
    const loginRes = await fetch(`${PYMO_BASE_URL}/${PYMO_VERSION}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: empresa.pymo_email,
        password: empresa.pymo_password_enc,
      }),
    });

    const loginData = await loginRes.json();
    if (loginData.status !== "SUCCESS") {
      return errorResponse(`Login PYMO falló: ${loginData.message?.value}`, 401);
    }

    const token = loginData.payload.token;

    // 3. Determinar tipo de CFE
    // 111 = eFactura (cliente con RUT), 101 = eTicket (consumidor final)
    const tipoCfe = cliente?.rut ? "111" : "101";

    // 4. Calcular IVA por ítem
    const items = sale.sale_items.map((item: any, i: number) => {
      const tasa = item.tasa_iva ?? 22;
      const neto = parseFloat((item.subtotal / (1 + tasa / 100)).toFixed(2));
      const iva = parseFloat((item.subtotal - neto).toFixed(2));
      return {
        "NroLinDet": i + 1,
        "NomItem": item.product_name,
        "Cantidad": item.quantity,
        "PrecioUnitario": item.unit_price,
        "MontoItem": item.subtotal,
        "TasaIva": tasa,
        "MontoIva": iva,
      };
    });

    // 5. Armar payload PYMO
    const payload = {
      emailsToNotify: [],
      phonesToNotify: [],
      [tipoCfe]: [
        {
          clientEmissionId: sale.id,
          IdDoc: {
            MntBruto: "1",
            FmaPago: sale.payment_method === "credit" ? "2" : "1",
            CAEEspecial: "2",
          },
          Emisor: {
            InfoAdicionalEmisor: empresa.nombre_empresa,
          },
          ...(tipoCfe === "111" && cliente ? {
            Receptor: {
              TipoDocRecep: cliente.tipo_doc_recep ?? "2",
              CodPaisRecep: cliente.cod_pais_recep ?? "UY",
              DocRecep: cliente.rut,
              RznSocRecep: cliente.rzn_soc ?? cliente.name,
              DirRecep: cliente.dir_recep ?? "",
              CiudadRecep: cliente.ciudad_recep ?? "Montevideo",
              DeptoRecep: cliente.depto_recep ?? "Montevideo",
            },
          } : {}),
          Totales: {
            TpoMoneda: "UYU",
            TpoCambio: "1",
          },
          Items: items,
        },
      ],
    };

    // 6. Enviar a PYMO
    const cfeRes = await fetch(
      `${PYMO_BASE_URL}/${PYMO_VERSION}/companies/${empresa.pymo_rut}/sendCfes/0`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const cfeData = await cfeRes.json();

    // 7. Guardar log siempre
    await supabase.from("cfe_logs").insert({
      sale_id: sale.id,
      empresa_id: sale.empresa_id,
      client_emission_id: sale.id,
      payload_enviado: payload,
      respuesta_pymo: cfeData,
      estado: cfeData.status === "SUCCESS" ? "enviado" : "error",
    });

    // 8. Si OK, actualizar sales
    if (cfeData.status === "SUCCESS") {
      const cfeResult = cfeData.payload?.cfesIds?.[0];
      await supabase.from("sales").update({
        estado_cfe: "enviado",
        tipo_cfe: tipoCfe,
        client_emission_id: sale.id,
        cfe_id: cfeResult?.id,
        cfe_serie: cfeResult?.serie,
        cfe_nro: cfeResult?.nro,
        cae_number: cfeResult?.caeNumber,
        qr_url: cfeResult?.qrUrl,
        security_code: cfeResult?.securityCode,
        sent_xml_hash: cfeResult?.sentXmlHash,
        fecha_emision_cfe: new Date().toISOString(),
        respuesta_pymo: cfeData,
      }).eq("id", sale.id);
    }

    return new Response(JSON.stringify(cfeData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return errorResponse(`Error interno: ${e.message}`, 500);
  }
});

function errorResponse(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
