import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════
//  BAIRRO NORMALIZATION RULES (Phase 1)
// ══════════════════════════════════════════════════

const BAIRRO_MAP: Record<string, string> = {
  "COAB 1": "Doutor Fábio Talarico",
  "COHAB 1": "Doutor Fábio Talarico",
  "CHOAB 1": "Doutor Fábio Talarico",
  "COAB 2": "Mario Garcia da Costa",
  "COHAB 2": "Mario Garcia da Costa",
  "CHOAB 2": "Mario Garcia da Costa",
  "MUTIRAO 1": "Conjunto Habitacional Padre Mário Lano",
  "MUTIRAO 3": "Etelvina Santana da Silva",
  "CECAP": "Conjunto Habitacional Geralda Geltrudes da Silva",
  "ELIZIO": "Campos Elíseos",
  "CAMPOS ELIZIO": "Campos Elíseos",
  "CAMPOS ELISA": "Campos Elíseos",
  "CAMPOS ELISEOS": "Campos Elíseos",
  "ELIZA": "Jardim Eliza",
  "ELISA": "Jardim Eliza",
  "JD ELIZA": "Jardim Eliza",
  "JARDIM ELIZA": "Jardim Eliza",
  "JD ELISA": "Jardim Eliza",
  "JARDIM ELISA": "Jardim Eliza",
  "JOAO VACARO": "João Vaccaro",
  "JOAO VACCARO": "João Vaccaro",
  "JOSE PUGLIESI": "Conjunto Habitacional Prefeito José Pugliesi",
  "JOSE PUGLIESE": "Conjunto Habitacional Prefeito José Pugliesi",
  "REINALDO STEIN": "Residencial Reynaldo Stein",
  "REYNALDO STEIN": "Residencial Reynaldo Stein",
  "REINALDO STEM": "Residencial Reynaldo Stein",
  "REYNALDO STEM": "Residencial Reynaldo Stein",
  "VILLE": "Residencial Nobre Ville",
  "NOBRE VILLE": "Residencial Nobre Ville",
  "BOM JESUS": "Vila São Bom Jesus Lapa",
  "NADIA": "Residencial Nadia",
  "NADIA 3": "Residencial Nadia",
  "NADIA 4": "Residencial Nadia 4",
  "SANTA ISABEL": "Desmembramento Recreio Santa Isabel",
  "VIVENDAS": "Vivendas do Bom Jardim",
  "VIVENDAS DO BOM JARDIM": "Vivendas do Bom Jardim",
  "TONICO GARCIA": "Conjunto Residencial Antonio Garcia",
  "GUAIRA E": "Conjunto Habitacional Gabriel Garcia de Carvalho",
  "BAIRRO GUAIRA E": "Conjunto Habitacional Gabriel Garcia de Carvalho",
  "PORTAL DO LAGO": "Portal do Lago",
  "PORTAL LAGO": "Portal do Lago",
  "PORTAL DO": "Portal do Lago",
  "MURAISHI": "Residencial Muraishi",
  "MURAISHI 1": "Residencial Muraishi",
  "MURAISHI 2": "Residencial Muraishi II",
  "BANESPINHA": "Residencial Antonio Nery Lopes",
};

interface BairroResult {
  bairro_classificacao: string;
  bairro_normalizado: string;
  bairro_complemento: string;
}

function normStr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBairroRules(bairroRaw: string): BairroResult {
  const raw = (bairroRaw || "").trim();
  if (!raw) return { bairro_classificacao: "REVISAR", bairro_normalizado: "", bairro_complemento: "" };

  const upper = normStr(raw);

  // JARDIM sozinho or JE => RUIDO
  if (upper === "JARDIM" || upper === "JE" || upper === "JD") {
    return { bairro_classificacao: "RUIDO", bairro_normalizado: "", bairro_complemento: raw };
  }

  // CENTRO special
  if (upper.startsWith("CENTRO")) {
    const rest = raw.substring(6).trim().replace(/^[\-,]+/, "").trim();
    return {
      bairro_classificacao: rest ? "COMPLEMENTO" : "OK",
      bairro_normalizado: "Centro",
      bairro_complemento: rest,
    };
  }

  // "ENTRE", "3X1", number-only patterns => COMPLEMENTO
  if (/^ENTRE\b/.test(upper) || /^\d+X\d+/.test(upper) || /^\d+$/.test(upper)) {
    return { bairro_classificacao: "COMPLEMENTO", bairro_normalizado: "", bairro_complemento: raw };
  }

  // Direct map lookup (try longest match first)
  const keys = Object.keys(BAIRRO_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const normKey = normStr(key);
    if (upper === normKey || upper.startsWith(normKey + " ")) {
      const rest = raw.substring(key.length).trim().replace(/^[\-,]+/, "").trim();
      // Portal do Lago complement handling
      const portal = BAIRRO_MAP[key];
      if (portal === "Portal do Lago" && rest) {
        return {
          bairro_classificacao: "COMPLEMENTO",
          bairro_normalizado: portal + " " + rest.toUpperCase(),
          bairro_complemento: rest,
        };
      }
      return {
        bairro_classificacao: rest ? "COMPLEMENTO" : "OK",
        bairro_normalizado: BAIRRO_MAP[key],
        bairro_complemento: rest,
      };
    }
  }

  // No rule matched - keep as-is
  return { bairro_classificacao: "OK", bairro_normalizado: raw, bairro_complemento: "" };
}

// ══════════════════════════════════════════════════
//  ADDRESS PARSER
// ══════════════════════════════════════════════════

interface ParsedAddress {
  logradouro: string;
  numero: string;
  bairro: string;
}

function parseEndereco(endereco: string): ParsedAddress {
  const raw = (endereco || "").trim();
  if (!raw) return { logradouro: "", numero: "", bairro: "" };

  let work = raw;
  let bairro = "";

  // Extract bairro after "BAIRRO" keyword
  const bairroMatch = work.match(/\bBAIRRO\s+(.+)$/i);
  if (bairroMatch) {
    bairro = bairroMatch[1].trim();
    work = work.substring(0, bairroMatch.index).trim();
  }

  // Extract number patterns: N 861, N861, numero 681, n: 681, n° 424, nº 424, etc.
  let numero = "";
  const numPatterns = [
    /\b(?:N(?:UMERO|[°º.:])?\s*)(\d+[A-Z]?)\b/i,
    /\bN(\d+[A-Z]?)\b/i,
    /,\s*(\d+[A-Z]?)\s*(?:[-,]|$)/i,
  ];

  for (const pat of numPatterns) {
    const m = work.match(pat);
    if (m) {
      numero = m[1];
      work = work.replace(m[0], " ").trim();
      break;
    }
  }

  // Clean logradouro
  const logradouro = work
    .replace(/\s*[-,]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return { logradouro, numero, bairro: bairro || "" };
}

// ══════════════════════════════════════════════════
//  FUZZY MATCHING UTILITIES
// ══════════════════════════════════════════════════

function tokenize(s: string): Set<string> {
  return new Set(
    normStr(s)
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

function softJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

function seqRatio(a: string, b: string): number {
  const s1 = normStr(a);
  const s2 = normStr(b);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const len = s1.length + s2.length;
  if (len === 0) return 1;

  // Simple LCS-based ratio (SequenceMatcher-like)
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / len;
}

function calcScore(
  candidate: string,
  reference: string,
  tokenWeight: number,
  seqWeight: number
): { token_score: number; seq_ratio: number; score_final: number } {
  const tA = tokenize(candidate);
  const tB = tokenize(reference);
  const token_score = softJaccard(tA, tB);
  const seq = seqRatio(candidate, reference);
  return {
    token_score: Math.round(token_score * 10000) / 10000,
    seq_ratio: Math.round(seq * 10000) / 10000,
    score_final: Math.round((tokenWeight * token_score + seqWeight * seq) * 10000) / 10000,
  };
}

// ══════════════════════════════════════════════════
//  MAIN MATCHING PIPELINE
// ══════════════════════════════════════════════════

interface CepRecord {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

interface MatchConfig {
  bairro_fuzzy_threshold: number;
  min_score_logradouro: number;
  token_threshold: number;
  ambiguous_gap: number;
  token_weight: number;
  seq_weight: number;
  fallback_global: boolean;
}

interface MatchResult {
  endereco_usado: string;
  parsed_logradouro: string;
  parsed_numero: string;
  parsed_bairro: string;
  bairro_classificacao: string;
  bairro_normalizado: string;
  bairro_complemento: string;
  bairro_candidato: string;
  bairro_gate: string;
  bairro_anchor_ok: boolean;
  bairro_score: number;
  bairro_canonico: string;
  bairro_canonico_key: string;
  logradouro_score: number;
  logradouro_token_score: number;
  logradouro_seq_ratio: number;
  top1_score: number;
  top2_score: number;
  top1_top2_gap: number;
  match_ok: boolean;
  matched_logradouro: string;
  matched_numero: string;
  matched_bairro: string;
  matched_cep: string;
  matched_cidade: string;
  matched_uf: string;
  matched_endereco_completo: string;
  review_status: string;
  review_reason: string;
}

function buildBairroIndex(ceps: CepRecord[]): Map<string, CepRecord[]> {
  const idx = new Map<string, CepRecord[]>();
  for (const c of ceps) {
    const key = normStr(c.bairro || "");
    if (!key) continue;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push(c);
  }
  return idx;
}

function matchBairro(
  bairroCandidato: string,
  bairroIndex: Map<string, CepRecord[]>,
  config: MatchConfig
): { gate: string; anchor_ok: boolean; score: number; canonico: string; canonico_key: string } {
  const normCand = normStr(bairroCandidato);
  if (!normCand) return { gate: "FAIL", anchor_ok: false, score: 0, canonico: "", canonico_key: "" };

  // EXACT match
  if (bairroIndex.has(normCand)) {
    const first = bairroIndex.get(normCand)![0];
    return { gate: "EXACT", anchor_ok: true, score: 1, canonico: first.bairro, canonico_key: normCand };
  }

  // FUZZY match
  let bestScore = 0;
  let bestKey = "";
  let bestBairro = "";
  for (const [key, records] of bairroIndex) {
    const s = calcScore(normCand, key, config.token_weight, config.seq_weight);
    if (s.score_final > bestScore) {
      bestScore = s.score_final;
      bestKey = key;
      bestBairro = records[0].bairro;
    }
  }

  if (bestScore >= config.bairro_fuzzy_threshold) {
    return {
      gate: "FUZZY",
      anchor_ok: true,
      score: Math.round(bestScore * 10000) / 10000,
      canonico: bestBairro,
      canonico_key: bestKey,
    };
  }

  return { gate: "FAIL", anchor_ok: false, score: bestScore, canonico: "", canonico_key: "" };
}

function matchLogradouro(
  parsed: string,
  candidatos: CepRecord[],
  config: MatchConfig
): {
  score: number;
  token_score: number;
  seq_ratio: number;
  top1: number;
  top2: number;
  gap: number;
  matched: CepRecord | null;
  review_status: string;
  review_reason: string;
} {
  if (!parsed || candidatos.length === 0) {
    return {
      score: 0, token_score: 0, seq_ratio: 0, top1: 0, top2: 0, gap: 0,
      matched: null, review_status: "FAIL", review_reason: "SEM_CANDIDATOS",
    };
  }

  const scored = candidatos.map((c) => ({
    record: c,
    ...calcScore(parsed, c.logradouro || "", config.token_weight, config.seq_weight),
  }));
  scored.sort((a, b) => b.score_final - a.score_final);

  const top1 = scored[0]?.score_final || 0;
  const top2 = scored.length > 1 ? scored[1].score_final : 0;
  const gap = Math.round((top1 - top2) * 10000) / 10000;

  if (top1 < config.min_score_logradouro) {
    return {
      score: top1, token_score: scored[0]?.token_score || 0, seq_ratio: scored[0]?.seq_ratio || 0,
      top1, top2, gap, matched: null,
      review_status: "REVIEW", review_reason: "LOGRADOURO_SCORE_BAIXO",
    };
  }

  if (gap < config.ambiguous_gap && scored.length > 1) {
    return {
      score: top1, token_score: scored[0].token_score, seq_ratio: scored[0].seq_ratio,
      top1, top2, gap, matched: scored[0].record,
      review_status: "REVIEW", review_reason: "AMBIGUO_TOP2_PROXIMO",
    };
  }

  return {
    score: top1, token_score: scored[0].token_score, seq_ratio: scored[0].seq_ratio,
    top1, top2, gap, matched: scored[0].record,
    review_status: "OK", review_reason: "",
  };
}

function parseCidadeUf(cidade: string): { cidade: string; uf: string } {
  if (!cidade) return { cidade: "", uf: "" };
  const parts = cidade.split(/\s*[\/\-]\s*/);
  if (parts.length >= 2) {
    const uf = parts[parts.length - 1].trim();
    const cid = parts.slice(0, -1).join(" ").trim();
    if (uf.length <= 2) return { cidade: cid, uf: uf.toUpperCase() };
  }
  return { cidade: cidade.trim(), uf: "" };
}

function processRow(
  endereco: string,
  cepBase: CepRecord[],
  bairroIndex: Map<string, CepRecord[]>,
  config: MatchConfig
): MatchResult {
  const parsed = parseEndereco(endereco);
  const bairroNorm = normalizeBairroRules(parsed.bairro || endereco);
  const bairroCandidato = bairroNorm.bairro_normalizado || parsed.bairro || "";

  // Phase 2: Bairro anchor
  const bairroMatch = matchBairro(bairroCandidato, bairroIndex, config);

  const result: MatchResult = {
    endereco_usado: endereco,
    parsed_logradouro: parsed.logradouro,
    parsed_numero: parsed.numero,
    parsed_bairro: parsed.bairro,
    bairro_classificacao: bairroNorm.bairro_classificacao,
    bairro_normalizado: bairroNorm.bairro_normalizado,
    bairro_complemento: bairroNorm.bairro_complemento,
    bairro_candidato: bairroCandidato,
    bairro_gate: bairroMatch.gate,
    bairro_anchor_ok: bairroMatch.anchor_ok,
    bairro_score: bairroMatch.score,
    bairro_canonico: bairroMatch.canonico,
    bairro_canonico_key: bairroMatch.canonico_key,
    logradouro_score: 0,
    logradouro_token_score: 0,
    logradouro_seq_ratio: 0,
    top1_score: 0,
    top2_score: 0,
    top1_top2_gap: 0,
    match_ok: false,
    matched_logradouro: "",
    matched_numero: parsed.numero,
    matched_bairro: "",
    matched_cep: "",
    matched_cidade: "",
    matched_uf: "",
    matched_endereco_completo: "",
    review_status: bairroMatch.anchor_ok ? "OK" : "REVIEW",
    review_reason: bairroMatch.anchor_ok ? "" : "BAIRRO_NAO_ANCORADO",
  };

  // Phase 3: Logradouro match
  let candidatos: CepRecord[] = [];
  if (bairroMatch.anchor_ok) {
    candidatos = bairroIndex.get(bairroMatch.canonico_key) || [];
  } else if (config.fallback_global) {
    candidatos = cepBase;
    result.review_status = "REVIEW";
    result.review_reason = "FALLBACK_GLOBAL";
  }

  if (candidatos.length > 0 && parsed.logradouro) {
    const logMatch = matchLogradouro(parsed.logradouro, candidatos, config);
    result.logradouro_score = logMatch.score;
    result.logradouro_token_score = logMatch.token_score;
    result.logradouro_seq_ratio = logMatch.seq_ratio;
    result.top1_score = logMatch.top1;
    result.top2_score = logMatch.top2;
    result.top1_top2_gap = logMatch.gap;

    if (logMatch.matched) {
      result.match_ok = logMatch.review_status === "OK";
      result.matched_logradouro = logMatch.matched.logradouro;
      result.matched_bairro = logMatch.matched.bairro;
      result.matched_cep = logMatch.matched.cep;
      const cu = parseCidadeUf(logMatch.matched.cidade);
      result.matched_cidade = cu.cidade;
      result.matched_uf = cu.uf || logMatch.matched.uf || "";
      result.matched_endereco_completo =
        `${result.matched_logradouro}, ${result.matched_numero} - ${result.matched_bairro}, ${result.matched_cidade}/${result.matched_uf} - ${result.matched_cep}`.replace(
          /\s+/g,
          " "
        );

      if (logMatch.review_status !== "OK") {
        result.review_status = logMatch.review_status;
        result.review_reason = logMatch.review_reason;
        // match_ok can still be true for AMBIGUO if score is high enough
        if (logMatch.review_reason === "AMBIGUO_TOP2_PROXIMO" && logMatch.score >= config.min_score_logradouro) {
          result.match_ok = true;
        }
      }
    } else {
      result.review_status = logMatch.review_status;
      result.review_reason = logMatch.review_reason;
    }
  }

  return result;
}

// ══════════════════════════════════════════════════
//  EDGE FUNCTION HANDLER
// ══════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      payers_csv,       // array of objects from CSV
      ceps_csv,         // optional: array of objects from CSV override
      use_db_ceps,      // boolean: use ceps table from DB
      config: userConfig,
      endereco_column,  // column name in payers CSV containing address
      cep_column,       // column name for CEP output
    } = body;

    if (!payers_csv || !Array.isArray(payers_csv) || payers_csv.length === 0) {
      return new Response(JSON.stringify({ error: "payers_csv é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: MatchConfig = {
      bairro_fuzzy_threshold: userConfig?.bairro_fuzzy_threshold ?? 0.405,
      min_score_logradouro: userConfig?.min_score_logradouro ?? 0.50,
      token_threshold: userConfig?.token_threshold ?? 0.82,
      ambiguous_gap: userConfig?.ambiguous_gap ?? 0.05,
      token_weight: userConfig?.token_weight ?? 0.45,
      seq_weight: userConfig?.seq_weight ?? 0.55,
      fallback_global: userConfig?.fallback_global ?? false,
    };

    // Build CEP base
    let cepBase: CepRecord[] = [];

    if (ceps_csv && Array.isArray(ceps_csv) && ceps_csv.length > 0) {
      cepBase = ceps_csv.map((r: Record<string, string>) => ({
        logradouro: r.logradouro || r.Logradouro || "",
        bairro: r.bairro || r.Bairro || "",
        cidade: r.cidade || r.Cidade || "",
        uf: r.uf || r.UF || "",
        cep: r.cep || r.CEP || r.Cep || "",
      }));
    }

    if (use_db_ceps !== false) {
      // Fetch all ceps from DB (may be large — paginate)
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("ceps")
          .select("logradouro, bairro, cidade, uf, cep")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          cepBase.push(
            ...data.map((r) => ({
              logradouro: r.logradouro || "",
              bairro: r.bairro || "",
              cidade: r.cidade || "",
              uf: r.uf || "",
              cep: r.cep || "",
            }))
          );
        }
        hasMore = (data?.length || 0) === pageSize;
        page++;
      }
    }

    if (cepBase.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma base de CEPs disponível" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bairroIndex = buildBairroIndex(cepBase);
    const endCol = endereco_column || "Endereco";

    // Process each payer row
    const results = payers_csv.map((row: Record<string, unknown>) => {
      const endereco = String(row[endCol] || "");
      const matchResult = processRow(endereco, cepBase, bairroIndex, config);
      return { ...row, ...matchResult };
    });

    // Summary stats
    const total = results.length;
    const matched = results.filter((r: MatchResult) => r.match_ok).length;
    const review = results.filter((r: MatchResult) => r.review_status === "REVIEW").length;
    const failed = results.filter((r: MatchResult) => !r.match_ok && r.review_status !== "REVIEW").length;

    // Bairro diagnostics
    const bairroStats = new Map<string, { count: number; gate: string }>();
    for (const r of results as MatchResult[]) {
      const key = r.bairro_candidato || "(vazio)";
      if (!bairroStats.has(key)) bairroStats.set(key, { count: 0, gate: r.bairro_gate });
      bairroStats.get(key)!.count++;
    }
    const topBairros = Array.from(bairroStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([bairro, { count, gate }]) => ({ bairro, count, gate }));

    // Top failures
    const failures = (results as MatchResult[])
      .filter((r) => !r.match_ok)
      .slice(0, 50)
      .map((r) => ({
        endereco: r.endereco_usado,
        bairro_gate: r.bairro_gate,
        bairro_score: r.bairro_score,
        logradouro_score: r.logradouro_score,
        review_reason: r.review_reason,
      }));

    return new Response(
      JSON.stringify({
        results,
        summary: { total, matched, review, failed },
        diagnostics: { topBairros, failures },
        config,
        cep_base_size: cepBase.length,
        bairro_index_size: bairroIndex.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
