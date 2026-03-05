import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

type ProcessCampaignPayload = {
  action: "process_campaign";
  campaignId: string;
  limit?: number;
};

type SendTestPayload = {
  action: "send_test";
  phone: string;
  message: string;
};

type SyncContactsPayload = {
  action: "sync_contacts";
  providerId?: string;
};

type Payload = ProcessCampaignPayload | SendTestPayload | SyncContactsPayload;

function rid() {
  return crypto.randomUUID().slice(0, 8);
}

function normalizePhoneE164(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getProviderFromResponsePayload(payload: any) {
  return (
    payload?.key?.id ||
    payload?.data?.key?.id ||
    payload?.message?.key?.id ||
    payload?.id ||
    null
  );
}


function sanitizeApiKey(input: unknown) {
  return String(input ?? "").trim().replace(/^['"]|['"]$/g, "");
}

function providerDebugMeta(provider: any) {
  const key = sanitizeApiKey(provider?.api_key);
  return {
    provider_id: provider?.id ?? null,
    instance_name: provider?.instance_name ?? null,
    base_url: provider?.base_url ?? null,
    api_key_len: key.length,
    api_key_prefix: key ? `${key.slice(0, 4)}***` : null,
  };
}

function buildAuthHeadersCandidates(apiKeyInput: unknown) {
  const apiKey = sanitizeApiKey(apiKeyInput);
  if (!apiKey) return [];

  return [
    { apikey: apiKey },
    { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    { apikey: apiKey, authorization: `Bearer ${apiKey}` },
    { "x-api-key": apiKey },
    { Authorization: `Bearer ${apiKey}` },
    { authorization: `Bearer ${apiKey}` },
  ];
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function parseProviderErrorPayload(payload: any, status: number) {
  const baseError =
    payload?.message ||
    payload?.error ||
    payload?.response?.message ||
    payload?.response ||
    `HTTP ${status}`;

  if (status === 401) {
    return `${baseError} (verifique api_key da instancia, base_url e instance_name)`;
  }
  return baseError;
}

async function evolutionRequestWithAuthRetry(
  provider: any,
  endpoint: string,
  body: unknown,
  timeoutMs = 10000,
) {
  const authCandidates = buildAuthHeadersCandidates(provider?.api_key);
  if (authCandidates.length === 0) {
    return {
      ok: false,
      status: 400,
      payload: null,
      error: "api_key do provider esta vazio",
    };
  }

  let lastStatus = 0;
  let lastPayload: any = null;
  let lastError = "Falha de autenticacao no provider";

  for (let i = 0; i < authCandidates.length; i++) {
    const authHeaders = authCandidates[i];
    let response: Response;
    try {
      console.log("[whatsapp-dispatch] evolution_attempt", {
        endpoint,
        attempt: i + 1,
        total_attempts: authCandidates.length,
        header_keys: Object.keys(authHeaders),
        provider: providerDebugMeta(provider),
      });
      response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            ...authHeaders,
          } as Record<string, string>,
          body: JSON.stringify(body ?? {}),
        },
        timeoutMs,
      );
    } catch (err) {
      console.error("[whatsapp-dispatch] evolution_network_error", {
        endpoint,
        attempt: i + 1,
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        ok: false,
        status: 0,
        payload: null,
        error:
          err instanceof Error
            ? err.message
            : "Falha de rede/timeout no provider",
      };
    }

    const payload = await parseJsonSafe(response);
    if (response.ok) {
      console.log("[whatsapp-dispatch] evolution_success", {
        endpoint,
        attempt: i + 1,
        status: response.status,
      });
      return { ok: true, status: response.status, payload, error: null };
    }

    console.warn("[whatsapp-dispatch] evolution_non_2xx", {
      endpoint,
      attempt: i + 1,
      status: response.status,
      payload,
    });

    lastStatus = response.status;
    lastPayload = payload;
    lastError = parseProviderErrorPayload(payload, response.status);

    if (response.status !== 401) break;
  }

  return {
    ok: false,
    status: lastStatus,
    payload: lastPayload,
    error: lastError,
  };
}

async function sendEvolutionText(provider: any, phone: string, text: string) {
  const base = String(provider.base_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(provider.instance_name);
  const endpoint = `${base}/message/sendText/${instance}`;

  const res = await evolutionRequestWithAuthRetry(
    provider,
    endpoint,
    { number: phone, text },
    10000,
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "Falha ao enviar mensagem",
      providerMessageId: null,
    };
  }

  return {
    ok: true,
    providerMessageId: getProviderFromResponsePayload(res.payload),
    error: null,
  };
}

async function probeEvolution(provider: any) {
  const base = String(provider.base_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(provider.instance_name);
  const endpoint = `${base}/chat/findContacts/${instance}`;
  const res = await evolutionRequestWithAuthRetry(provider, endpoint, {}, 10000);
  if (res.ok) return { ok: true, error: null };
  return { ok: false, error: res.error || `HTTP ${res.status || 0}` };
}

async function getProvider(sb: any, providerId?: string) {
  if (providerId) {
    const { data, error } = await sb
      .from("whatsapp_providers")
      .select("id, active, base_url, instance_name, api_key")
      .eq("id", providerId)
      .single();

    if (error || !data)
      return { provider: null, error: "Provider não encontrado" };
    return { provider: data, error: null };
  }

  const { data, error } = await sb
    .from("whatsapp_providers")
    .select("id, active, base_url, instance_name, api_key")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data)
    return { provider: null, error: "Provider ativo não encontrado" };
  return { provider: data, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const requestId = rid();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error(
        "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY não configurados",
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token)
      return json(401, { ok: false, error: "Não autenticado", requestId });

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return json(401, { ok: false, error: "Token inválido", requestId });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch {
      return json(400, {
        ok: false,
        error: "JSON inválido no body",
        requestId,
      });
    }

    const action = (body as any)?.action;
    console.log(
      `[whatsapp-dispatch:${requestId}] action=${action} user=${authData.user.id}`,
    );

    if (action === "sync_contacts") {
      const { provider, error: providerErr } = await getProvider(
        sb,
        body.action === "sync_contacts" ? body.providerId : undefined,
      );
      if (providerErr || !provider)
        return json(400, { ok: false, error: providerErr, requestId });
      if (!provider.active)
        return json(400, { ok: false, error: "Provider inativo", requestId });
      const base = String(provider.base_url || "").replace(/\/+$/, "");
      const instance = encodeURIComponent(provider.instance_name);
      const endpoint = `${base}/chat/findContacts/${instance}`;

      const contactRes = await evolutionRequestWithAuthRetry(
        provider,
        endpoint,
        {},
        10000,
      );
      if (!contactRes.ok) {
        return json(400, {
          ok: false,
          error: contactRes.error || `HTTP ${contactRes.status || 0}`,
          requestId,
        });
      }

      const payload = contactRes.payload;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.response)
            ? payload.response
            : [];
      const rows = list
        .map((c: any) => {
          const wa_jid = c?.id ?? c?.remoteJid ?? null;
          const wa_number = String(
            wa_jid?.split("@")[0] ?? c?.number ?? "",
          ).replace(/\D/g, "");
          const display_name = c?.name ?? c?.pushName ?? c?.notify ?? null;

          return {
            provider_id: provider.id,
            instance_name: provider.instance_name,
            wa_number,
            wa_jid,
            display_name,
            raw: c,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r: any) => r.wa_number);

      if (rows.length > 0) {
        const { error: upsertError } = await sb
          .from("whatsapp_contacts")
          .upsert(rows, {
            onConflict: "provider_id,instance_name,wa_number",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          return json(500, {
            ok: false,
            error: upsertError.message,
            requestId,
          });
        }
      }

      console.log(`[whatsapp-dispatch:${requestId}] sync_contacts_done total=${rows.length}`);
      return json(200, { ok: true, total: rows.length, requestId });
    }

    if (action === "send_test") {
      if (body.action !== "send_test")
        return json(400, { ok: false, error: "Payload inválido", requestId });

      const phone = normalizePhoneE164(body.phone);
      const message = String(body.message || "").trim();
      if (!phone || !message)
        return json(400, {
          ok: false,
          error: "phone/message obrigatórios",
          requestId,
        });

      const { provider, error: providerErr } = await getProvider(sb);
      if (providerErr || !provider)
        return json(400, { ok: false, error: providerErr, requestId });
      if (!provider.active)
        return json(400, { ok: false, error: "Provider inativo", requestId });
      const sent = await sendEvolutionText(provider, phone, message);
      if (!sent.ok) {
        console.error(
          `[whatsapp-dispatch:${requestId}] send_test_fail`,
          sent.error,
        );
        return json(400, { ok: false, error: sent.error, requestId });
      }

      console.log(`[whatsapp-dispatch:${requestId}] send_test_ok providerMessageId=${sent.providerMessageId ?? "null"}`);
      return json(200, {
        ok: true,
        providerMessageId: sent.providerMessageId,
        requestId,
      });
    }

    if (action !== "process_campaign") {
      return json(400, { ok: false, error: "Ação inválida", requestId });
    }

    if (body.action !== "process_campaign")
      return json(400, { ok: false, error: "Payload inválido", requestId });

    let lockedCampaignId: string | null = null;

    try {
      const limit = Math.max(1, Math.min(body.limit ?? 50, 200));

      const { data: campaign, error: campaignError } = await sb
        .from("whatsapp_campaigns")
        .select("id, status, provider_id")
        .eq("id", body.campaignId)
        .single();

      if (campaignError || !campaign)
        return json(404, {
          ok: false,
          error: "Campanha não encontrada",
          requestId,
        });
      if (!campaign.provider_id)
        return json(400, {
          ok: false,
          error: "Campanha sem provider configurado",
          requestId,
        });

      if (campaign.status === "PROCESSING") {
        return json(409, {
          ok: false,
          error: "Campanha já está em processamento",
          requestId,
        });
      }

      const { data: lockRows, error: lockError } = await sb
        .from("whatsapp_campaigns")
        .update({ status: "PROCESSING" })
        .eq("id", campaign.id)
        .in("status", ["DRAFT", "QUEUED", "FAILED"])
        .select("id");

      if (lockError)
        return json(500, { ok: false, error: lockError.message, requestId });
      if (!lockRows || lockRows.length === 0) {
        return json(409, {
          ok: false,
          error: "Campanha bloqueada por concorrência",
          requestId,
        });
      }

      lockedCampaignId = campaign.id;

      const { data: provider, error: providerError } = await sb
        .from("whatsapp_providers")
        .select("id, active, base_url, instance_name, api_key")
        .eq("id", campaign.provider_id)
        .single();

      if (providerError || !provider)
        return json(400, {
          ok: false,
          error: "Provider não encontrado",
          requestId,
        });
      if (!provider.active)
        return json(400, { ok: false, error: "Provider inativo", requestId });
      const { data: pendingMessages, error: pendingError } = await sb
        .from("whatsapp_messages")
        .select("id, phone_e164, body, attempt_count")
        .eq("campaign_id", campaign.id)
        .eq("status", "PENDING")
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (pendingError)
        return json(500, { ok: false, error: pendingError.message, requestId });

      let sent = 0;
      let failed = 0;

      for (const msg of pendingMessages || []) {
        const phone = normalizePhoneE164(msg.phone_e164);

        if (!phone) {
          failed += 1;
          await sb
            .from("whatsapp_messages")
            .update({
              status: "FAILED",
              attempt_count: (msg.attempt_count || 0) + 1,
              last_error: "Telefone inválido",
            })
            .eq("id", msg.id);
          continue;
        }

        const result = await sendEvolutionText(provider, phone, msg.body);

        if (result.ok) {
          sent += 1;
          await sb
            .from("whatsapp_messages")
            .update({
              status: "SENT",
              provider_message_id: result.providerMessageId,
              sent_at: new Date().toISOString(),
              attempt_count: (msg.attempt_count || 0) + 1,
              last_error: null,
            })
            .eq("id", msg.id);
        } else {
          failed += 1;
          await sb
            .from("whatsapp_messages")
            .update({
              status: "FAILED",
              attempt_count: (msg.attempt_count || 0) + 1,
              last_error: result.error || "Falha no envio",
            })
            .eq("id", msg.id);
        }
      }

      const [
        { count: pendingCount },
        { count: sentCount },
        { count: failedCount },
      ] = await Promise.all([
        sb
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "PENDING"),
        sb
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "SENT"),
        sb
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .eq("status", "FAILED"),
      ]);

      const finalStatus =
        (pendingCount || 0) > 0
          ? "QUEUED"
          : (failedCount || 0) > 0
            ? "FAILED"
            : "COMPLETED";

      await sb
        .from("whatsapp_campaigns")
        .update({
          status: finalStatus,
          sent_messages: sentCount || 0,
          failed_messages: failedCount || 0,
        })
        .eq("id", campaign.id)
        .eq("status", "PROCESSING");

      console.log(
        `[whatsapp-dispatch:${requestId}] done campaign=${campaign.id} sent=${sent} failed=${failed} pending=${pendingCount || 0}`,
      );

      return json(200, {
        ok: true,
        campaignId: campaign.id,
        processed: (pendingMessages || []).length,
        sent,
        failed,
        pending: pendingCount || 0,
        requestId,
      });
    } catch (processError) {
      console.error(
        `[whatsapp-dispatch:${requestId}] process_campaign_error`,
        processError,
      );

      if (lockedCampaignId) {
        await sb
          .from("whatsapp_campaigns")
          .update({ status: "FAILED" })
          .eq("id", lockedCampaignId)
          .eq("status", "PROCESSING");
      }

      return json(500, {
        ok: false,
        error:
          processError instanceof Error
            ? processError.message
            : "Erro interno no processamento",
        requestId,
      });
    }
  } catch (error) {
    console.error(`[whatsapp-dispatch:${requestId}] fatal_error`, error);
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno",
      requestId,
    });
  }
});

