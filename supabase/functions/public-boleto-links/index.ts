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

function maskPhone(phone: string) {
  if (!phone) return "";
  return phone.length >= 4 ? `***${phone.slice(-4)}` : "invalid";
}

function phoneMatch(inputPhone: string, rowPhone: string) {
  if (!inputPhone || !rowPhone) return false;
  if (inputPhone === rowPhone) return true;

  const inNo55 = inputPhone.startsWith("55") ? inputPhone.slice(2) : inputPhone;
  const rowNo55 = rowPhone.startsWith("55") ? rowPhone.slice(2) : rowPhone;

  if (inNo55 === rowNo55) return true;
  if (inNo55.endsWith(rowNo55) || rowNo55.endsWith(inNo55)) return true;

  return inNo55.slice(-8) === rowNo55.slice(-8);
}

serve(async (req) => {
  const requestId = rid();

  if (req.method === "OPTIONS") {
    console.log(`[public-boleto-links:${requestId}] cors_preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error(`[public-boleto-links:${requestId}] env_missing`, {
        has_supabase_url: !!SUPABASE_URL,
        has_service_role: !!SERVICE_ROLE,
      });
      return json(500, { ok: false, error: "Ambiente Supabase nao configurado", requestId });
    }

    let body: any;
    try {
      body = await req.json();
    } catch (error) {
      console.error(`[public-boleto-links:${requestId}] invalid_body`, {
        message: error instanceof Error ? error.message : String(error),
      });
      return json(400, { ok: false, error: "Body invalido", requestId });
    }

    const cpf = digits(body?.cpf);
    const phone = digits(body?.phone);
    const referenceMonth = String(body?.referenceMonth || "").trim();

    console.log(`[public-boleto-links:${requestId}] request_received`, {
      cpf: maskCpf(cpf),
      phone: maskPhone(phone),
      reference_month: referenceMonth || null,
    });

    if (cpf.length !== 11 || phone.length < 10) {
      console.warn(`[public-boleto-links:${requestId}] validation_failed`, {
        cpf_len: cpf.length,
        phone_len: phone.length,
      });
      return json(400, { ok: false, error: "CPF/WhatsApp invalidos", requestId });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let query = sb
      .from("payer_boleto_links")
      .select("reference_month, student_name, drive_url, phone_digits")
      .eq("cpf_digits", cpf)
      .order("reference_month", { ascending: false })
      .limit(100);

    if (/^\d{4}-\d{2}$/.test(referenceMonth)) {
      query = query.eq("reference_month", referenceMonth);
    } else if (referenceMonth.length > 0) {
      console.warn(`[public-boleto-links:${requestId}] reference_month_ignored`, { reference_month: referenceMonth });
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[public-boleto-links:${requestId}] db_query_error`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return json(500, { ok: false, error: error.message, requestId });
    }

    const fetched = data || [];
    const rows = fetched.filter((row: any) => phoneMatch(phone, digits(row.phone_digits)));

    const items = rows.map((row: any) => ({
      reference_month: row.reference_month,
      student_name: row.student_name,
      drive_url: row.drive_url,
    }));

    console.log(`[public-boleto-links:${requestId}] success`, {
      fetched_rows: fetched.length,
      matched_rows: items.length,
    });

    return json(200, { ok: true, items, requestId });
  } catch (error) {
    console.error(`[public-boleto-links:${requestId}] fatal_error`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno",
      requestId,
    });
  }
});
