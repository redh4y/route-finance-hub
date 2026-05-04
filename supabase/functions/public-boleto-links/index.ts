import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
};

type Action = "list_bills" | "log_download" | "download_bill";

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

function sanitizeFileNamePart(value: string | null | undefined) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAttachmentFileName(studentName: string | null | undefined, referenceMonth: string | null | undefined) {
  const safeName = sanitizeFileNamePart(studentName) || "boleto";
  const safeRef = String(referenceMonth || "").trim() || "sem-referencia";
  return `${safeName} - ${safeRef}.pdf`;
}

function billingStatusPriority(status: string) {
  switch (status) {
    case "PAID":
      return 4;
    case "OPEN":
      return 3;
    case "CANCELADO":
      return 2;
    case "NEEDS_REVIEW":
      return 1;
    default:
      return 0;
  }
}

function toPublicBillingStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "PAID") return "PAGO";
  if (normalized === "CANCELADO") return "CANCELADO";
  if (normalized === "NEEDS_REVIEW") return "REVISAO";
  if (normalized === "OPEN") {
    const today = new Date().toISOString().slice(0, 10);
    if (dueDate && dueDate < today) return "VENCIDO";
    return "EM_ABERTO";
  }

  return null;
}

async function writeAccessLog(sb: any, payload: Record<string, unknown>) {
  const { error } = await sb.from("public_boleto_access_logs").insert([payload]);
  if (error) {
    console.warn("[public-boleto-links] failed_to_write_log", error.message);
  }
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

    // Support both POST (JSON body) and GET (query params) for download_bill
    let body: any;
    const url = new URL(req.url);
    const qsAction = url.searchParams.get("action");

    if (req.method === "GET" && qsAction === "download_bill") {
      // GET request from hidden iframe – read params from query string
      body = {
        action: "download_bill",
        cpf: url.searchParams.get("cpf") || "",
        driveUrl: url.searchParams.get("driveUrl") || "",
        referenceMonth: url.searchParams.get("referenceMonth") || "",
        studentName: url.searchParams.get("studentName") || "",
      };
    } else {
      try {
        body = await req.json();
      } catch {
        return json(400, { ok: false, error: "Body invalido", requestId });
      }
    }

    const action = (String(body?.action || "list_bills").trim() || "list_bills") as Action;
    const cpf = digits(body?.cpf);
    const referenceMonth = String(body?.referenceMonth || "").trim();
    const userAgent = String(req.headers.get("user-agent") || "").slice(0, 500);

    console.log(`[public-boleto-links:${requestId}] request_received`, {
      action,
      cpf: maskCpf(cpf),
      reference_month: referenceMonth || null,
    });

    if (cpf.length !== 11) {
      return json(400, { ok: false, error: "CPF invalido", requestId });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    if (action === "log_download") {
      await writeAccessLog(sb, {
        action: "DOWNLOAD",
        cpf_digits: cpf,
        reference_month: referenceMonth || null,
        student_name: String(body?.studentName || "") || null,
        drive_url: String(body?.driveUrl || "") || null,
        user_agent: userAgent || null,
        request_id: requestId,
      });

      return json(200, { ok: true, requestId });
    }

    if (action === "download_bill") {
      const driveUrl = String(body?.driveUrl || "").trim();
      if (!driveUrl) {
        return json(400, { ok: false, error: "Link do boleto nao informado", requestId });
      }

      const { data: boletoRow, error: boletoError } = await sb
        .from("payer_boleto_links")
        .select("reference_month, student_name, drive_url")
        .eq("cpf_digits", cpf)
        .eq("drive_url", driveUrl)
        .limit(1)
        .maybeSingle();

      if (boletoError) {
        return json(500, { ok: false, error: boletoError.message, requestId });
      }

      if (!boletoRow) {
        return json(404, { ok: false, error: "Boleto nao encontrado para este CPF", requestId });
      }

      await writeAccessLog(sb, {
        action: "DOWNLOAD",
        cpf_digits: cpf,
        reference_month: boletoRow.reference_month || null,
        student_name: boletoRow.student_name || null,
        drive_url: boletoRow.drive_url,
        user_agent: userAgent || null,
        request_id: requestId,
      });

      let upstream: Response;
      try {
        upstream = await fetch(boletoRow.drive_url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": userAgent || "TavaresFinance/2via",
          },
        });
      } catch (error) {
        return json(502, {
          ok: false,
          error: error instanceof Error ? error.message : "Falha ao baixar arquivo no Google Drive",
          requestId,
        });
      }

      if (!upstream.ok || !upstream.body) {
        const upstreamMessage = await upstream.text().catch(() => "");
        return json(502, {
          ok: false,
          error: upstreamMessage || `Falha ao baixar arquivo do Drive (${upstream.status})`,
          requestId,
        });
      }

      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "no-store");
      headers.set("Content-Type", upstream.headers.get("content-type") || "application/pdf");
      headers.set(
        "Content-Disposition",
        `attachment; filename="${buildAttachmentFileName(boletoRow.student_name, boletoRow.reference_month)}"`,
      );

      return new Response(upstream.body, {
        status: 200,
        headers,
      });
    }

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
      await writeAccessLog(sb, {
        action: "SEARCH",
        cpf_digits: cpf,
        reference_month: referenceMonth || null,
        student_name: null,
        found_count: 0,
        user_agent: userAgent || null,
        request_id: requestId,
      });
      return json(200, { ok: false, error: "CPF nao encontrado no cadastro", requestId });
    }

    let query = sb
      .from("payer_boleto_links")
      .select("reference_month, student_name, drive_url, due_date, amount_cents, our_number, digitable_line, created_at")
      .eq("cpf_digits", cpf)
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("reference_month", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (/^\d{4}-\d{2}$/.test(referenceMonth)) {
      query = query.eq("reference_month", referenceMonth);
    }

    const { data, error } = await query;
    if (error) {
      return json(500, { ok: false, error: error.message, requestId });
    }

    const links = data || [];

    // Normalize our_number: strip bank-prefix "XX/" so "26/101239-6" → "101239-6"
    function normalizeOurNumber(raw: string | null | undefined): string {
      const s = String(raw || "").trim();
      const slashIdx = s.indexOf("/");
      return slashIdx !== -1 ? s.slice(slashIdx + 1).trim() : s;
    }

    type BillingEntry = { status: string | null; due_date: string | null };

    // Fetch ALL billings for this payer — no nosso_numero filter so format mismatches are handled in code
    const billingsByNormalizedOurNumber = new Map<string, BillingEntry>();
    const billingsByRefMonth = new Map<string, BillingEntry>();

    const { data: billingRows, error: billingsError } = await sb
      .from("billings")
      .select("nosso_numero, status, due_date, reference_month")
      .eq("payer_id", payer.id);

    if (billingsError) {
      return json(500, { ok: false, error: billingsError.message, requestId });
    }

    function upsertBillingEntry(map: Map<string, BillingEntry>, key: string, row: any) {
      if (!key) return;
      const current = map.get(key);
      const newPriority = billingStatusPriority(String(row.status || ""));
      if (!current || newPriority >= billingStatusPriority(String(current.status || ""))) {
        map.set(key, { status: row.status ?? null, due_date: row.due_date ?? null });
      }
    }

    for (const row of billingRows || []) {
      // Index by exact nosso_numero
      const exact = String(row.nosso_numero || "").trim();
      upsertBillingEntry(billingsByNormalizedOurNumber, exact, row);
      // Index by normalized (without bank prefix)
      const normalized = normalizeOurNumber(row.nosso_numero);
      if (normalized && normalized !== exact) {
        upsertBillingEntry(billingsByNormalizedOurNumber, normalized, row);
      }
      // Index by reference_month as fallback
      const refMonth = String(row.reference_month || "").trim();
      upsertBillingEntry(billingsByRefMonth, refMonth, row);
    }

    function resolveBillingEntry(row: any): BillingEntry | null {
      const ourNum = String(row.our_number || "").trim();
      if (ourNum) {
        // Try exact match
        const exact = billingsByNormalizedOurNumber.get(ourNum);
        if (exact) return exact;
        // Try normalized match
        const norm = normalizeOurNumber(ourNum);
        const normalized = billingsByNormalizedOurNumber.get(norm);
        if (normalized) return normalized;
      }
      // Fallback: match by reference_month (catches boletos with no our_number or unresolvable number)
      const refMonth = String(row.reference_month || "").trim();
      return billingsByRefMonth.get(refMonth) ?? null;
    }

    const items = (links || [])
      .map((row: any) => {
        const entry = resolveBillingEntry(row);
        const billingStatus = entry?.status ?? null;
        const publicStatus = toPublicBillingStatus(billingStatus, entry?.due_date ?? row.due_date ?? null);

        return {
          reference_month: row.reference_month,
          student_name: row.student_name,
          drive_url: row.drive_url,
          due_date: row.due_date,
          amount_cents: row.amount_cents,
          our_number: row.our_number,
          digitable_line: row.digitable_line,
          billing_status: billingStatus,
          public_status: publicStatus,
        };
      })
      .filter((row: any) => row.public_status !== "CANCELADO");

    const studentNames = Array.from(
      new Set(items.map((r: any) => r.student_name).filter(Boolean)),
    );

    await writeAccessLog(sb, {
      action: "SEARCH",
      cpf_digits: cpf,
      reference_month: referenceMonth || null,
      student_name: studentNames.join(", ") || null,
      found_count: items.length,
      user_agent: userAgent || null,
      request_id: requestId,
    });

    return json(200, { ok: true, items, requestId });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno",
      requestId,
    });
  }
});
