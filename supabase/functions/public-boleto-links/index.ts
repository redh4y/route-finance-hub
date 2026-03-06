import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

function rid() {
  return crypto.randomUUID().slice(0, 8);
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function maskCpf(cpf: string) {
  if (!cpf) return "";
  return cpf.length === 11 ? `${cpf.slice(0, 3)}***${cpf.slice(-2)}` : "invalid";
}

serve(async (req) => {
  const requestId = rid();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, { ok: false, error: "Ambiente Supabase nao configurado", requestId });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "Body invalido", requestId });
    }

    const cpf = digits(body?.cpf);
    const referenceMonth = String(body?.referenceMonth || "").trim();

    console.log(`[public-boleto-links:${requestId}] request_received`, {
      cpf: maskCpf(cpf),
      reference_month: referenceMonth || null,
    });

    if (cpf.length !== 11) {
      return json(400, { ok: false, error: "CPF invalido", requestId });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: payer, error: payerError } = await sb
      .from("payers")
      .select("id")
      .eq("document_digits", cpf)
      .limit(1)
      .maybeSingle();

    if (payerError) {
      return json(500, { ok: false, error: payerError.message, requestId });
    }

    if (!payer) {
      return json(404, { ok: false, error: "CPF nao encontrado no cadastro", requestId });
    }

    let query = sb
      .from("payer_boleto_links")
      .select("reference_month, student_name, drive_url")
      .eq("cpf_digits", cpf)
      .order("reference_month", { ascending: false })
      .limit(100);

    if (/^\d{4}-\d{2}$/.test(referenceMonth)) {
      query = query.eq("reference_month", referenceMonth);
    }

    const { data, error } = await query;
    if (error) {
      return json(500, { ok: false, error: error.message, requestId });
    }

    const items = (data || []).map((row: any) => ({
      reference_month: row.reference_month,
      student_name: row.student_name,
      drive_url: row.drive_url,
    }));

    return json(200, { ok: true, items, requestId });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno",
      requestId,
    });
  }
});
