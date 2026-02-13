import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, vehicles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const vehicleList = (vehicles || []).map((v: { name: string; plate: string }) => `${v.name} (${v.plate || "sem placa"})`).join(", ");

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
        tools: [
          {
            type: "function",
            function: {
              name: "parse_maintenance_report",
              description: "Parse a maintenance report into structured data",
              parameters: {
                type: "object",
                properties: {
                  vehicle_suggestion: { type: "string", nullable: true },
                  title: { type: "string" },
                  category: { type: "string" },
                  subcategory: { type: "string" },
                  priority: { type: "string", enum: ["BAIXA", "MEDIA", "ALTA", "CRITICA"] },
                  impact_type: { type: "string", enum: ["seguranca", "conforto", "operacao"] },
                  description: { type: "string" },
                },
                required: ["title", "category", "priority", "impact_type", "description"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_maintenance_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let parsed;
    if (toolCall?.function?.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse content as JSON
      const content = result.choices?.[0]?.message?.content || "";
      parsed = JSON.parse(content);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("maintenance-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
