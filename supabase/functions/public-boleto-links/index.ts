import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, { ok: false, error: "Ambiente Supabase nao configurado" });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "Body invalido" });
    }

    const cpf = digits(body?.cpf);
    const phone = digits(body?.phone);
    const referenceMonth = String(body?.referenceMonth || "").trim();

    if (cpf.length !== 11 || phone.length < 10) {
      return json(400, { ok: false, error: "CPF/WhatsApp invalidos" });
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
    }

    const { data, error } = await query;
    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    const rows = (data || []).filter((row: any) => phoneMatch(phone, digits(row.phone_digits)));

    const items = rows.map((row: any) => ({
      reference_month: row.reference_month,
      student_name: row.student_name,
      drive_url: row.drive_url,
    }));

    return json(200, { ok: true, items });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno",
    });
  }
});
