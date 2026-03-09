import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { description, amount_cents, type, existing_groups, existing_subgroups } = await req.json();

    if (!description) {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um classificador contábil para uma empresa de transporte escolar e excursões.
Dado um lançamento financeiro, sugira o grupo e subgrupo DRE mais adequados.

Grupos disponíveis (com IDs):
${JSON.stringify(existing_groups, null, 2)}

Subgrupos disponíveis (com IDs e grupo pai):
${JSON.stringify(existing_subgroups, null, 2)}

Regras:
- CUSTO = operação direta (combustível, manutenção, motoristas, pedágios)
- DESPESA = administrativo (aluguel, contabilidade, software, marketing)
- Retorne SOMENTE IDs existentes dos grupos e subgrupos
- Se não houver certeza, retorne confidence "low"`;

    const userPrompt = `Classifique este lançamento:
- Descrição: "${description}"
- Valor: R$ ${(amount_cents / 100).toFixed(2)}
- Tipo: ${type}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_entry",
              description: "Classify a financial entry into DRE group and subgroup",
              parameters: {
                type: "object",
                properties: {
                  group_id: { type: "string", description: "UUID of the suggested DRE group" },
                  group_name: { type: "string", description: "Name of the suggested group" },
                  subgroup_id: { type: ["string", "null"], description: "UUID of the suggested subgroup or null" },
                  subgroup_name: { type: ["string", "null"], description: "Name of the suggested subgroup or null" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  reasoning: { type: "string", description: "Brief reasoning for the classification" },
                },
                required: ["group_id", "group_name", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_entry" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-entry error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
