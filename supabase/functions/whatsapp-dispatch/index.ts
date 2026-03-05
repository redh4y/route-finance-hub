import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function rid() {
  return crypto.randomUUID().slice(0, 8);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

type Payload = ProcessCampaignPayload | SendTestPayload;

function normalizePhoneE164(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

async function sendEvolutionText(provider: any, phone: string, text: string) {
  const base = String(provider.base_url || "").replace(/\/+$/, "");
  const instance = encodeURIComponent(provider.instance_name);
  const endpoint = `${base}/message/sendText/${instance}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: provider.api_key,
      Authorization: `Bearer ${provider.api_key}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ number: phone, text }),
  });

  const responseText = await response.text();
  let payload: any = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { raw: responseText };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.message || payload?.error || `HTTP ${response.status}`,
      providerMessageId: null,
    };
  }

  const providerMessageId =
    payload?.key?.id ||
    payload?.data?.key?.id ||
    payload?.message?.key?.id ||
    payload?.id ||
    null;

  return { ok: true, providerMessageId, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as Payload;
    if (body.action !== "process_campaign") {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.max(1, Math.min(body.limit ?? 50, 200));

    const { data: campaign, error: campaignError } = await sb
      .from("whatsapp_campaigns")
      .select("id, status, provider_id")
      .eq("id", body.campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campanha não encontrada");
    }

    if (!campaign.provider_id) {
      throw new Error("Campanha sem provider configurado");
    }

    const { data: provider, error: providerError } = await sb
      .from("whatsapp_providers")
      .select("id, active, base_url, instance_name, api_key")
      .eq("id", campaign.provider_id)
      .single();

    if (providerError || !provider) {
      throw new Error("Provider não encontrado");
    }
    if (!provider.active) {
      throw new Error("Provider está inativo");
    }

    await sb
      .from("whatsapp_campaigns")
      .update({ status: "PROCESSING" })
      .eq("id", campaign.id);

    const { data: pendingMessages, error: pendingError } = await sb
      .from("whatsapp_messages")
      .select("id, phone_e164, body, attempt_count")
      .eq("campaign_id", campaign.id)
      .eq("status", "PENDING")
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (pendingError) throw pendingError;

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

    const [{ count: pendingCount }, { count: sentCount }, { count: failedCount }] = await Promise.all([
      sb
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "PENDING"),
      sb
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "SENT"),
      sb
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "FAILED"),
    ]);

    const finalStatus = (pendingCount || 0) > 0 ? "QUEUED" : (failedCount || 0) > 0 ? "FAILED" : "COMPLETED";

    await sb
      .from("whatsapp_campaigns")
      .update({
        status: finalStatus,
        sent_messages: sentCount || 0,
        failed_messages: failedCount || 0,
      })
      .eq("id", campaign.id);

    console.log(`[whatsapp-dispatch:${requestId}] campaign_done campaignId=${campaign.id} sent=${sent} failed=${failed} pending=${pendingCount || 0}`);
    return new Response(
      JSON.stringify({
        ok: true,
        campaignId: campaign.id,
        processed: (pendingMessages || []).length,
        sent,
        failed,
        pending: pendingCount || 0,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("whatsapp-dispatch error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
