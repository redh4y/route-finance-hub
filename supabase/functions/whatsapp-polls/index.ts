import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Evolution API adapter ──────────────────────────────────────────────
async function getProviderConfig(sb: ReturnType<typeof adminClient>, providerId?: string) {
  let query = sb.from("whatsapp_providers").select("*").eq("active", true);
  if (providerId) query = query.eq("id", providerId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) throw new Error("Nenhum provider ativo encontrado");
  return data as {
    id: string;
    base_url: string;
    api_key: string;
    instance_name: string;
    name: string;
  };
}

async function evolutionRequest(
  provider: Awaited<ReturnType<typeof getProviderConfig>>,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const url = `${provider.base_url}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: provider.api_key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evolution API ${res.status}: ${text}`);
  }
  return res.json();
}

async function getInstanceStatus(provider: Awaited<ReturnType<typeof getProviderConfig>>) {
  try {
    const data = await evolutionRequest(provider, `/instance/connectionState/${provider.instance_name}`);
    return { connected: data?.instance?.state === "open", raw: data };
  } catch (e: unknown) {
    return { connected: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendGroupPoll(
  provider: Awaited<ReturnType<typeof getProviderConfig>>,
  groupJid: string,
  question: string,
  options: string[],
  selectableCount = 1,
) {
  const body = {
    number: groupJid,
    name: question,
    selectableCount,
    values: options,
  };
  return evolutionRequest(
    provider,
    `/message/sendPoll/${provider.instance_name}`,
    "POST",
    body,
  );
}

async function fetchGroups(provider: Awaited<ReturnType<typeof getProviderConfig>>) {
  return evolutionRequest(provider, `/group/fetchAllGroups/${provider.instance_name}?getParticipants=false`);
}

// ── Log helper ─────────────────────────────────────────────────────────
async function log(
  sb: ReturnType<typeof adminClient>,
  level: string,
  eventType: string,
  message: string,
  referenceId?: string,
  payload?: unknown,
) {
  await sb.from("integration_logs").insert({
    module: "whatsapp_polls",
    level,
    event_type: eventType,
    reference_id: referenceId ?? null,
    message,
    payload: payload ?? null,
  });
}

// ── Phone normalization ────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0];
}

// ── Handlers ───────────────────────────────────────────────────────────
async function handleStatus(sb: ReturnType<typeof adminClient>, providerId?: string) {
  const provider = await getProviderConfig(sb, providerId);
  const status = await getInstanceStatus(provider);
  return json({ ok: true, provider: { id: provider.id, name: provider.name }, ...status });
}

async function handleSendPoll(
  sb: ReturnType<typeof adminClient>,
  body: {
    groupId: string;
    templateId?: string;
    question?: string;
    options?: string[];
    selectableCount?: number;
    providerId?: string;
  },
) {
  const provider = await getProviderConfig(sb, body.providerId);

  // Get group
  const { data: group } = await sb.from("whatsapp_groups").select("*").eq("id", body.groupId).single();
  if (!group) throw new Error("Grupo não encontrado");

  let question = body.question || "";
  let options: string[] = body.options || [];
  let selectableCount = body.selectableCount || 1;

  // If template provided, use it
  if (body.templateId) {
    const { data: tpl } = await sb.from("poll_templates").select("*").eq("id", body.templateId).single();
    if (tpl) {
      question = tpl.question;
      options = (tpl.options as string[]) || [];
      selectableCount = tpl.selectable_count || 1;
    }
  }

  if (!question || options.length < 2) throw new Error("Enquete inválida: precisa de pergunta e pelo menos 2 opções");

  // Send via Evolution API
  const result = await sendGroupPoll(provider, group.group_jid, question, options, selectableCount);

  // Save poll record
  const { data: poll, error: pollErr } = await sb.from("polls").insert({
    external_poll_id: result?.key?.id || null,
    instance_id: provider.id,
    group_id: body.groupId,
    template_id: body.templateId || null,
    question,
    options: options,
    selectable_count: selectableCount,
    status: "sent",
    sent_at: new Date().toISOString(),
    poll_date: new Date().toISOString().split("T")[0],
  }).select("id").single();

  if (pollErr) throw pollErr;

  await log(sb, "info", "poll_sent", `Enquete enviada para ${group.name}`, poll?.id, { groupJid: group.group_jid, question });

  return json({ ok: true, pollId: poll?.id, evolutionResult: result });
}

async function handleImportGroups(sb: ReturnType<typeof adminClient>, providerId?: string) {
  const provider = await getProviderConfig(sb, providerId);
  const groups = await fetchGroups(provider);

  if (!Array.isArray(groups)) throw new Error("Resposta inesperada da Evolution API");

  let imported = 0;
  for (const g of groups) {
    const jid = g.id || g.jid;
    if (!jid) continue;
    const name = g.subject || g.name || jid;

    await sb.from("whatsapp_groups").upsert(
      {
        group_jid: jid,
        name,
        description: g.desc || null,
        instance_id: provider.id,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "group_jid" },
    );
    imported++;
  }

  await log(sb, "info", "groups_imported", `${imported} grupos importados`, provider.id);
  return json({ ok: true, imported });
}

async function handleWebhook(sb: ReturnType<typeof adminClient>, body: unknown) {
  const payload = body as Record<string, unknown>;
  const event = payload.event as string;

  await log(sb, "debug", "webhook_received", `Webhook: ${event}`, null, payload);

  // Handle poll vote updates
  if (event === "messages.update" || event === "messages.upsert") {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return json({ ok: true, ignored: true });

    // Try to extract poll vote info from Evolution API v2 format
    const message = data.message as Record<string, unknown> | undefined;
    const pollUpdate = (data as Record<string, unknown>).pollUpdateMessage || 
                       message?.pollUpdateMessage;

    if (pollUpdate) {
      return await processPollVote(sb, payload);
    }
  }

  // Handle specific poll update event
  if (event === "poll.vote" || event === "polls.vote") {
    return await processPollVote(sb, payload);
  }

  return json({ ok: true, processed: false, event });
}

async function processPollVote(sb: ReturnType<typeof adminClient>, payload: Record<string, unknown>) {
  try {
    const data = payload.data as Record<string, unknown>;
    if (!data) return json({ ok: true, ignored: true });

    const voterJid = (data.voter as string) || 
                     (data.participant as string) ||
                     ((data.key as Record<string, unknown>)?.participant as string) || "";
    const voterPhone = normalizePhone(jidToPhone(voterJid));
    const selectedOptions = (data.selectedOptions as string[]) || 
                            (data.selectedValues as string[]) || [];

    if (!voterJid || selectedOptions.length === 0) {
      return json({ ok: true, ignored: true, reason: "no_voter_or_options" });
    }

    // Find poll by external ID or recent poll for this group
    const pollMessageId = (data.pollCreationMessageKey as Record<string, unknown>)?.id as string ||
                          (data.msgId as string) || "";
    const remoteJid = ((data.key as Record<string, unknown>)?.remoteJid as string) ||
                      (data.chatJid as string) || "";

    let poll;
    if (pollMessageId) {
      const { data: p } = await sb.from("polls")
        .select("*")
        .eq("external_poll_id", pollMessageId)
        .maybeSingle();
      poll = p;
    }

    if (!poll && remoteJid) {
      // Find group and most recent poll
      const { data: group } = await sb.from("whatsapp_groups")
        .select("id")
        .eq("group_jid", remoteJid)
        .maybeSingle();
      
      if (group) {
        const { data: p } = await sb.from("polls")
          .select("*")
          .eq("group_id", group.id)
          .eq("poll_date", new Date().toISOString().split("T")[0])
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        poll = p;
      }
    }

    if (!poll) {
      await log(sb, "warn", "vote_no_poll", "Voto recebido sem enquete correspondente", null, { voterJid, selectedOptions });
      return json({ ok: true, ignored: true, reason: "poll_not_found" });
    }

    const selectedOption = selectedOptions[0] || "";

    // Try to match student by phone
    let studentId: string | null = null;
    if (voterPhone) {
      const { data: student } = await sb.from("students")
        .select("id")
        .or(`phone_e164.eq.${voterPhone},phone_e164.ilike.%${voterPhone}`)
        .limit(1)
        .maybeSingle();
      if (student) studentId = student.id;
    }

    // Upsert vote
    const { data: existingVote } = await sb.from("poll_votes")
      .select("id, selected_option")
      .eq("poll_id", poll.id)
      .eq("voter_jid", voterJid)
      .maybeSingle();

    if (existingVote) {
      // Update existing vote — save history
      if (existingVote.selected_option !== selectedOption) {
        await sb.from("poll_vote_history").insert({
          poll_vote_id: existingVote.id,
          previous_option: existingVote.selected_option,
          new_option: selectedOption,
          raw_payload: payload,
        });
      }

      await sb.from("poll_votes").update({
        selected_option: selectedOption,
        selected_option_index: selectedOptions.length > 0 ? 0 : null,
        voted_at: new Date().toISOString(),
        student_id: studentId,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      }).eq("id", existingVote.id);
    } else {
      await sb.from("poll_votes").insert({
        poll_id: poll.id,
        voter_phone: voterPhone,
        voter_jid: voterJid,
        student_id: studentId,
        selected_option: selectedOption,
        selected_option_index: 0,
        voted_at: new Date().toISOString(),
        raw_payload: payload,
      });
    }

    await log(sb, "info", "vote_processed", `Voto de ${voterPhone}: ${selectedOption}`, poll.id);
    return json({ ok: true, processed: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(sb, "error", "vote_error", msg, null, payload);
    return json({ ok: false, error: msg }, 500);
  }
}

// ── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = adminClient();
    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action as string || new URL(req.url).searchParams.get("action") || "";

    switch (action) {
      case "status":
        return await handleStatus(sb, body.providerId);
      case "send_poll":
        return await handleSendPoll(sb, body);
      case "import_groups":
        return await handleImportGroups(sb, body.providerId);
      case "webhook":
        return await handleWebhook(sb, body);
      default:
        return json({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("whatsapp-polls error:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});
