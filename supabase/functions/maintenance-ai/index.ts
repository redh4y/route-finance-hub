import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY not configured");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json(401, { error: "Nao autenticado" });

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) return json(401, { error: "Token invalido" });

    const body = await req.json();
    const text = String(body?.text || "").trim();
    const vehicles = Array.isArray(body?.vehicles) ? body.vehicles : [];

    if (!text) return json(400, { error: "Campo 'text' obrigatorio" });
    if (text.length > 3000) return json(400, { error: "Texto muito grande (max 3000 caracteres)" });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const vehicleList = vehicles
      .slice(0, 200)
      .map((v: { name?: string; plate?: string }) => `${v?.name || "sem nome"} (${v?.plate || "sem placa"})`)
      .join(", ");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de manutenção de frota de ônibus. O usuário vai descrever um problema de forma livre. Analise e retorne APENAS um JSON com os campos:
- vehicle_suggestion: nome do veículo mais provável (baseado na lista: ${vehicleList}) ou null
- title: título resumido do problema (max 60 chars)
- category: uma entre MECANICA, ELETRICA, ESTRUTURAL, HIGIENE, DOCUMENTACAO, PNEUS, FREIOS, MOTOR, OUTRO
- subcategory: subcategoria específica
- priority: uma entre BAIXA, MEDIA, ALTA, CRITICA
- impact_type: uma entre seguranca, conforto, operacao
- description: descrição detalhada do problema baseada no relato

Retorne SOMENTE o JSON, sem markdown.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return json(429, { error: "Limite de requisições atingido. Tente novamente em instantes." });
      }
      if (response.status === 402) {
        return json(402, { error: "Créditos insuficientes para IA." });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return json(200, parsed);
  } catch (e) {
    console.error("maintenance-ai error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
