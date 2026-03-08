import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════
//  CONSTANTS (mirroring Python)
// ══════════════════════════════════════════════════

const STOPWORDS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

const NOISE_TOKENS = new Set([
  "JE", "JD", "JARD", "AP", "APT", "APTO", "BL", "BLOCO", "CS", "CASA", "LT", "LOTE",
  "QD", "QUADRA", "KM", "CEP", "FUNDOS", "FTE", "FRENTE",
]);

const TITLE_TOKENS = new Set(["DOUTOR", "DR", "DRA", "ENG", "PROF", "PROFA"]);

const STREET_TYPES = new Set([
  "RUA", "AVENIDA", "PRACA", "ALAMEDA", "TRAVESSA",
  "RODOVIA", "ESTRADA", "VIA", "LARGO", "PASSAGEM",
]);

const BAIRRO_ANCHORS = new Set([
  "JARDIM", "JD", "CENTRO", "VILA", "RESIDENCIAL", "PORTAL", "COAB", "COHAB",
  "MUTIRAO", "CECAP", "BOM", "SAO",
]);

const NUM_MARKERS = new Set(["N", "NO", "NR", "NUM", "NUMERO"]);

const WEIGHT_JACCARD = 0.45;
const WEIGHT_SEQ = 0.55;

// ══════════════════════════════════════════════════
//  TEXT NORMALIZATION (mirroring Python)
// ══════════════════════════════════════════════════

function stripAccents(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function _normalizeNumMarkers(s: string): string {
  // "Nº123" → "Nº 123", "N:123" → "N 123", etc.
  s = s.replace(/\b(NUMERO|NUM|NO|N)\s*([:\\-]?)\s*(\d)/g, "$1 $3");
  s = s.replace(/\b(NUMERO|NUM|NO|N)(\d)/g, "$1 $2");
  return s;
}

function normText(s: string): string {
  s = stripAccents(s).toUpperCase();
  s = s.replace(/\xa0/g, " ");
  s = s.replace(/[.,;:/\\\-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  s = s.replace(/\bAV\.\b/g, "AVENIDA");
  s = s.replace(/\bAV\b/g, "AVENIDA");
  s = s.replace(/\bR\b/g, "RUA");
  s = s.replace(/\bPCA\b/g, "PRACA");

  s = _normalizeNumMarkers(s);

  // Join number + single letter suffix: "15 B" → "15B" (but not N/O which could be markers)
  s = s.replace(/\b(\d+)\s+([A-MO-Z])\b/g, "$1$2");

  // Expand concatenated forms: "AV3" → "AVENIDA 3", "R5" → "RUA 5"
  s = s.replace(/\bAV(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bR(\d+[A-Z]?)\b/g, "RUA $1");
  s = s.replace(/\bAVENIDA(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bRUA(\d+[A-Z]?)\b/g, "RUA $1");

  return s;
}

function normTextKeepNumbers(s: string): string {
  s = stripAccents(s).toUpperCase();
  s = s.replace(/\xa0/g, " ");
  s = s.replace(/[.,;:/\\\-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  s = s.replace(/\bAV\.\b/g, "AVENIDA");
  s = s.replace(/\bAV\b/g, "AVENIDA");
  s = s.replace(/\bR\b/g, "RUA");
  s = s.replace(/\bPCA\b/g, "PRACA");

  s = _normalizeNumMarkers(s);

  // Join number + single letter suffix
  s = s.replace(/\b(\d+)\s+([A-MO-Z])\b/g, "$1$2");

  // Expand concatenated forms
  s = s.replace(/\bAV(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bR(\d+[A-Z]?)\b/g, "RUA $1");
  s = s.replace(/\bAVENIDA(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bRUA(\d+[A-Z]?)\b/g, "RUA $1");

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function preprocessForMatch(s: string): string {
  s = normText(s);
  // Remove number markers + number
  s = s.replace(/\b(?:N|NO|NR|NUM|NUMERO)\s*\d+[A-Z]?\b/g, " ");

  const toks = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let prev = "";

  for (const t of toks) {
    const isNum = /^\d+[A-Z]?$/.test(t);
    if (isNum) {
      // Keep only if previous token is a street type (e.g., "RUA 36")
      if (STREET_TYPES.has(prev)) {
        out.push(t);
      }
    } else {
      out.push(t);
    }
    prev = t;
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}

// ══════════════════════════════════════════════════
//  TOKENIZATION / SIMILARITY (mirroring Python)
// ══════════════════════════════════════════════════

function _normalizeBairroTokens(toks: string[]): string[] {
  const mapping: Record<string, string> = { "JD": "JARDIM", "JARD": "JARDIM" };
  return toks.map(t => mapping[t] || t);
}

function tokenList(s: string, aggressive: boolean, mode: string): string[] {
  s = preprocessForMatch(s);
  const toks: string[] = [];
  for (const t of s.split(/\s+/)) {
    if (!t || STOPWORDS.has(t)) continue;
    const isStreetNumToken = /^\d+[A-Z]?$/.test(t);
    if (aggressive) {
      if (t.length <= 2 && !isStreetNumToken) continue;
      if (NOISE_TOKENS.has(t)) continue;
      if (TITLE_TOKENS.has(t)) continue;
    }
    toks.push(t);
  }
  if (mode === "bairro") return _normalizeBairroTokens(toks);
  return toks;
}

function tokenSim(a: string, b: string): number {
  // SequenceMatcher-like ratio between two tokens
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / (m + n);
}

function softJaccard(qTokens: string[], refTokens: string[], tokenThreshold: number): number {
  if (!qTokens.length && !refTokens.length) return 1;
  if (!qTokens.length || !refTokens.length) return 0;

  const refUsed = new Set<number>();
  let matches = 0;

  for (const qt of qTokens) {
    let bestI = -1;
    let bestS = 0;
    for (let i = 0; i < refTokens.length; i++) {
      if (refUsed.has(i)) continue;
      const s = tokenSim(qt, refTokens[i]);
      if (s > bestS) {
        bestS = s;
        bestI = i;
      }
    }
    if (bestS >= tokenThreshold && bestI >= 0) {
      matches++;
      refUsed.add(bestI);
    }
  }

  const union = new Set(qTokens).size + new Set(refTokens).size - matches;
  return union ? matches / union : 0;
}

function seqRatio(a: string, b: string): number {
  const s1 = preprocessForMatch(a);
  const s2 = preprocessForMatch(b);
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / (m + n);
}

interface ScoreResult {
  score_final: number;
  token_score: number;
  seq_ratio: number;
  q_tokens: string;
  r_tokens: string;
}

function scoreComponents(query: string, ref: string, tokenThreshold: number, mode: string): ScoreResult {
  const qToks = tokenList(query, true, mode);
  const rToks = tokenList(ref, false, mode);
  const sJ = softJaccard(qToks, rToks, tokenThreshold);
  const sR = seqRatio(query, ref);
  const sFinal = WEIGHT_JACCARD * sJ + WEIGHT_SEQ * sR;
  return {
    score_final: sFinal,
    token_score: sJ,
    seq_ratio: sR,
    q_tokens: qToks.join(" "),
    r_tokens: rToks.join(" "),
  };
}

// ══════════════════════════════════════════════════
//  BAIRRO NORMALIZATION RULES (mirroring Python)
// ══════════════════════════════════════════════════

function _simNorm(a: string, b: string): number {
  const na = normText(a);
  const nb = normText(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const m = na.length;
  const n = nb.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (na[i - 1] === nb[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / (m + n);
}

function _titleCaseKeepRoman(s: string): string {
  const romans = new Set(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  return s.split(/\s+/).map(w => romans.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function _hasComplementPattern(raw: string): boolean {
  if (raw.includes("ENTRE")) return true;
  if (/\b\d+\s*[Xx×]\s*\d+\b/.test(raw)) return true;
  if (/\b\d+X\d+\b/.test(raw)) return true;
  return false;
}

function _splitBairroComplemento(raw: string): [string, string] {
  const toks = raw.split(/\s+/);
  if (!toks.length) return ["", ""];
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === "ENTRE") return [toks.slice(0, i).join(" ").trim(), toks.slice(i).join(" ").trim()];
    if (/\d+X\d+/.test(toks[i])) return [toks.slice(0, i).join(" ").trim(), toks.slice(i).join(" ").trim()];
    if (toks[i] === "X" || toks[i] === "×") return [toks.slice(0, i).join(" ").trim(), toks.slice(i).join(" ").trim()];
  }
  return [raw, ""];
}

function _mergeComplement(a: string | null, b: string | null): string {
  const aa = (a || "").trim();
  const bb = (b || "").trim();
  if (aa && bb) return `${aa} ${bb}`.trim();
  return aa || bb || "";
}

function _mapBairroAlias(rawNorm: string): [string | null, string | null] {
  // 1) COAB/COHAB
  if (/\b(COAB|COHAB|CHOAB)\s*I\b/.test(rawNorm)) return ["Doutor Fábio Talarico", null];
  if (/\b(COAB|COHAB|CHOAB)\s*II\b/.test(rawNorm)) return ["Mario Garcia da Costa", null];
  if (/\bCOA?H?AB\s*1\b/.test(rawNorm) || /\bCOAB1\b/.test(rawNorm) || /\bCOHAB1\b/.test(rawNorm))
    return ["Doutor Fábio Talarico", null];
  if (/\bCOA?H?AB\s*2\b/.test(rawNorm) || /\bCOAB2\b/.test(rawNorm) || /\bCOHAB2\b/.test(rawNorm))
    return ["Mario Garcia da Costa", null];

  // 2) Mutirao
  if (/\bMUTIRAO\s*1\b/.test(rawNorm) || /\bMUTIRAO1\b/.test(rawNorm))
    return ["Conjunto Habitacional Padre Mário Lano", null];
  if (/\bMUTIRAO\s*3\b/.test(rawNorm) || /\bMUTIRAO3\b/.test(rawNorm))
    return ["Etelvina Santana da Silva", null];

  // 3) CECAP
  if (rawNorm === "CECAP") return ["Conjunto Habitacional Geralda Geltrudes da Silva", null];

  // 4) Campos Eliseos
  if (rawNorm.includes("ELIZIO") || rawNorm.includes("CAMPOS ELIZIO") || rawNorm.includes("CAMPOS ELISA"))
    return ["Campos Elíseos", null];

  // 5) Jardim Eliza
  if (/\bJARDIM\s+ELISA\b/.test(rawNorm) || /\bJARDIM\s+ELIZA\b/.test(rawNorm) || /\bJD\s+ELIZA\b/.test(rawNorm))
    return ["Jardim Eliza", null];
  if (/\bELIZA\b/.test(rawNorm)) return ["Jardim Eliza", null];
  if (rawNorm.includes("ELI") && Math.max(_simNorm(rawNorm, "ELIZA"), _simNorm(rawNorm, "ELISA"), _simNorm(rawNorm, "JARDIM ELIZA")) >= 0.80)
    return ["Jardim Eliza", null];

  // 6) Joao Vaccaro
  if (rawNorm.includes("JOAO VACARO") || rawNorm.includes("JOAO VACCARO") || rawNorm.includes("BAIRRO JOAO VACARO"))
    return ["João Vaccaro", null];

  // 7) Jose Pugliesi
  if (rawNorm.includes("JOSE PUGLIESI") || rawNorm.includes("JOSE PUGLIESE"))
    return ["Conjunto Habitacional Prefeito José Pugliesi", null];

  // 8) Reynaldo Stein
  if (rawNorm.includes("REINALDO STEIN") || rawNorm.includes("REYNALDO STEIN") || rawNorm.includes("REINALDO STEM"))
    return ["Residencial Reynaldo Stein", null];

  // 9) Nobre Ville
  if (/\bVILLE\b/.test(rawNorm)) return ["Residencial Nobre Ville", null];

  // 10) Bom Jesus
  if (rawNorm.includes("BOM JESUS")) return ["Vila São Bom Jesus Lapa", null];

  // 11) Nadia
  if (/\bNADIA\s*4\b/.test(rawNorm)) return ["Residencial Nadia 4", null];
  if (/\bNADIA\b/.test(rawNorm)) return ["Residencial Nadia", null];

  // 12) Santa Isabel
  if (rawNorm.includes("SANTA ISABEL")) return ["Desmembramento Recreio Santa Isabel", null];

  // SAO FRANCISCO
  if (rawNorm.trim() === "SAO FRANCISCO") return ["Jardim São Francisco I", null];

  // 13) Vivendas
  if (rawNorm.includes("VIVENDAS")) return ["Vivendas do Bom Jardim", null];

  // 14) Tonico Garcia
  if (rawNorm.includes("TONICO GARCIA")) return ["Conjunto Residencial Antonio Garcia", null];

  // 15) Guaíra E
  if (rawNorm.includes("GUAIRA E") || rawNorm.includes("BAIRRO GUAIRA E"))
    return ["Conjunto Habitacional Gabriel Garcia de Carvalho", null];

  // 16) Portal do Lago
  if (rawNorm.includes("PORTAL") && (rawNorm.includes("LAGO") || rawNorm.startsWith("PORTAL DO"))) {
    const tokens = rawNorm.split(/\s+/);
    const hasA = tokens.includes("A");
    const hasB = tokens.includes("B");
    let comp: string | null = null;
    if (hasA && hasB) comp = "A/B";
    else if (hasA) comp = "A";
    else if (hasB) comp = "B";
    return ["Portal do Lago", comp];
  }

  // 17) Muraishi
  if (rawNorm.includes("MURAISHI")) {
    const tokens = rawNorm.split(/\s+/);
    let idx = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "MURAISHI") { idx = i; break; }
    }
    if (idx >= 0) {
      let tail = tokens.slice(idx + 1);
      let normalized = "Residencial Muraishi";
      if (tail.length > 0) {
        if (tail[0] === "2" || tail[0] === "II") {
          normalized = "Residencial Muraishi II";
          tail = tail.slice(1);
        } else if (tail[0] === "1" || tail[0] === "I") {
          tail = tail.slice(1);
        }
      }
      const comp = tail.length > 0 ? tail.join(" ").trim() : null;
      return [normalized, comp];
    }
  }

  // 18) Banespinha
  if (rawNorm.includes("BANESPINHA")) return ["Residencial Antonio Nery Lopes", null];

  return [null, null];
}

interface BairroResult {
  bairro_classificacao: string;
  bairro_normalizado: string;
  bairro_complemento: string;
}

function normalizeBairroRules(bairroRaw: string): BairroResult {
  let raw = normText(bairroRaw || "");
  if (!raw) return { bairro_classificacao: "", bairro_normalizado: "", bairro_complemento: "" };

  // Remove leading "BAIRRO" keyword
  raw = raw.replace(/^\bBAIRRO\b\s+/, "").trim();
  raw = raw.replace(/\bMURAUSHI\b/g, "MURAISHI");

  // Noise
  if (raw === "JARDIM" || raw === "JE") {
    return { bairro_classificacao: "RUIDO", bairro_normalizado: "", bairro_complemento: "" };
  }

  // Banespinha
  if (raw.includes("BANESPINHA")) {
    return { bairro_classificacao: "OK", bairro_normalizado: "Residencial Antonio Nery Lopes", bairro_complemento: "" };
  }

  // CENTRO
  if (raw === "CENTRO") {
    return { bairro_classificacao: "OK", bairro_normalizado: "Centro", bairro_complemento: "" };
  }
  if (raw.startsWith("CENTRO ")) {
    const complemento = raw.replace("CENTRO", "").trim();
    return { bairro_classificacao: "OK", bairro_normalizado: "Centro", bairro_complemento: complemento };
  }

  // Complement patterns (ENTRE, X)
  if (_hasComplementPattern(raw)) {
    const [bairroPart, complemento] = _splitBairroComplemento(raw);
    if (!bairroPart) {
      return { bairro_classificacao: "COMPLEMENTO", bairro_normalizado: "", bairro_complemento: complemento || raw };
    }
    const [mapped, comp2] = _mapBairroAlias(bairroPart);
    const mergedComp = _mergeComplement(complemento, comp2);
    if (mapped) {
      return { bairro_classificacao: "OK", bairro_normalizado: mapped, bairro_complemento: mergedComp };
    }
    return { bairro_classificacao: "OK", bairro_normalizado: _titleCaseKeepRoman(bairroPart), bairro_complemento: mergedComp };
  }

  // Direct alias mapping
  const [mapped, comp] = _mapBairroAlias(raw);
  if (mapped) {
    return { bairro_classificacao: "OK", bairro_normalizado: mapped, bairro_complemento: comp || "" };
  }

  return { bairro_classificacao: "OK", bairro_normalizado: _titleCaseKeepRoman(raw), bairro_complemento: "" };
}

// ══════════════════════════════════════════════════
//  BAIRRO HEURISTIC
// ══════════════════════════════════════════════════

function looksLikeBairroToken(t: string): boolean {
  const tn = normText(t);
  if (!tn) return false;
  if (BAIRRO_ANCHORS.has(tn)) return true;
  if (/^(COA?H?AB|COAB|COHAB)\d+$/.test(tn)) return true;
  if (/^(MUTIRAO)\d+$/.test(tn)) return true;
  if (/^(NADIA)\d+$/.test(tn)) return true;
  return false;
}

// ══════════════════════════════════════════════════
//  NUMBER EXTRACTION (mirroring Python)
// ══════════════════════════════════════════════════

function extractNumeroEndereco(endereco: string): string {
  const s = normTextKeepNumbers(endereco || "");

  const m = s.match(/\b(?:N|NO|NR|NUM|NUMERO)\s*(\d+[A-Z]?)\b/);
  if (m) return m[1].trim();

  const toks = s.split(/\s+/);
  const candidates: string[] = [];
  let prev = "";
  for (const t of toks) {
    if (/^\d+[A-Z]?$/.test(t)) {
      if (!STREET_TYPES.has(prev)) {
        candidates.push(t);
      }
    }
    prev = t;
  }

  if (!candidates.length) return "";

  const digitsLen = (x: string) => x.replace(/\D/g, "").length;
  const maxLen = Math.max(...candidates.map(digitsLen));
  const best = candidates.filter(c => digitsLen(c) === maxLen);
  return best.length > 0 ? best[best.length - 1].trim() : "";
}

// ══════════════════════════════════════════════════
//  ADDRESS PARSER (mirroring Python parse_endereco_parts)
// ══════════════════════════════════════════════════

interface ParsedAddress {
  logradouro: string;
  numero: string;
  bairro: string;
}

function parseEndereco(endereco: string): ParsedAddress {
  const s = normTextKeepNumbers(endereco || "");
  let toks = s.split(/\s+/).filter(Boolean);
  if (!toks.length) return { logradouro: "", numero: "", bairro: "" };

  // Find real start: if first token is not a street type, skip to the first one
  let start = 0;
  if (!STREET_TYPES.has(toks[0])) {
    for (let i = 0; i < toks.length; i++) {
      if (STREET_TYPES.has(toks[i])) {
        start = i;
        break;
      }
    }
  }
  toks = toks.slice(start);
  if (!toks.length) return { logradouro: "", numero: "", bairro: "" };

  // Extract numero via NUM_MARKERS
  let numero = "";
  let idxMarker: number | null = null;
  for (let i = 0; i < toks.length; i++) {
    if (NUM_MARKERS.has(toks[i]) && i + 1 < toks.length && /^\d+[A-Z]?$/.test(toks[i + 1])) {
      numero = toks[i + 1];
      idxMarker = i;
      break;
    }
  }

  // Fallback: extractNumeroEndereco
  let idxNumToken: number | null = null;
  if (!numero) {
    numero = extractNumeroEndereco(s);
    if (numero) {
      for (let i = 0; i < toks.length; i++) {
        if (toks[i] === numero) {
          idxNumToken = i;
          break;
        }
      }
    }
  }

  // Separate logradouro / bairro tokens
  let logTokens: string[];
  let afterNumTokens: string[];

  if (idxMarker !== null) {
    logTokens = toks.slice(0, idxMarker);
    afterNumTokens = (idxMarker + 2 <= toks.length) ? toks.slice(idxMarker + 2) : [];
  } else if (idxNumToken !== null) {
    logTokens = toks.slice(0, idxNumToken);
    afterNumTokens = toks.slice(idxNumToken + 1);
  } else {
    // No number found
    if (
      toks.length >= 3 &&
      STREET_TYPES.has(toks[0]) &&
      /^\d+[A-Z]?$/.test(toks[1]) &&
      looksLikeBairroToken(toks[2])
    ) {
      // "AVENIDA 3 CENTRO" → logradouro=AVENIDA 3, bairro=CENTRO...
      logTokens = toks.slice(0, 2);
      afterNumTokens = toks.slice(2);
    } else {
      logTokens = toks.slice(0, Math.min(3, toks.length));
      afterNumTokens = toks.slice(Math.min(3, toks.length));
    }
  }

  const logradouro = logTokens.join(" ").trim();

  // Bairro extraction from afterNumTokens
  let bairroTokens = [...afterNumTokens];
  let hasBairroMarker = false;

  const bairroIdx = bairroTokens.indexOf("BAIRRO");
  if (bairroIdx >= 0) {
    bairroTokens = bairroTokens.slice(bairroIdx + 1);
    hasBairroMarker = true;
  }

  if (!hasBairroMarker) {
    // Try to find anchor token
    for (let i = 0; i < bairroTokens.length; i++) {
      if (BAIRRO_ANCHORS.has(bairroTokens[i]) || looksLikeBairroToken(bairroTokens[i])) {
        bairroTokens = bairroTokens.slice(i);
        break;
      }
    }
  }

  const bairro = bairroTokens.join(" ").trim();
  return { logradouro, numero, bairro };
}

// ══════════════════════════════════════════════════
//  CEP REF / BAIRRO INDEX
// ══════════════════════════════════════════════════

interface CepRecord {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

function buildBairroIndex(ceps: CepRecord[]): Map<string, CepRecord[]> {
  const idx = new Map<string, CepRecord[]>();
  for (const c of ceps) {
    const key = normText(c.bairro || "");
    if (!key) continue;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push(c);
  }
  return idx;
}

function buildKeyToLabel(ceps: CepRecord[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of ceps) {
    const key = normText(c.bairro || "");
    if (key && !m.has(key)) m.set(key, c.bairro);
  }
  return m;
}

// ══════════════════════════════════════════════════
//  PHASE 2: BAIRRO RESOLUTION (mirroring Python)
// ══════════════════════════════════════════════════

interface BairroResolution {
  bairro_anchor_ok: boolean;
  bairro_gate: string;
  bairro_canonico: string;
  bairro_canonico_key: string;
  bairro_score: number;
  bairro_token_score: number;
  bairro_seq_ratio: number;
  bairro_tokens_query: string;
  bairro_tokens_ref: string;
}

function resolveBairroPagador(
  bairroCandidato: string,
  bairroClassificacao: string,
  bairroIndex: Map<string, CepRecord[]>,
  keyToLabel: Map<string, string>,
  tokenThreshold: number,
  bairroFuzzyThreshold: number,
): BairroResolution {
  const empty: BairroResolution = {
    bairro_anchor_ok: false, bairro_gate: "FAIL", bairro_canonico: "", bairro_canonico_key: "",
    bairro_score: 0, bairro_token_score: 0, bairro_seq_ratio: 0, bairro_tokens_query: "", bairro_tokens_ref: "",
  };
  if (!bairroCandidato) return empty;

  const keyExact = normText(bairroCandidato);
  if (bairroIndex.has(keyExact)) {
    const label = keyToLabel.get(keyExact) || "";
    const anchorOk = bairroClassificacao === "OK";
    const sc = scoreComponents(bairroCandidato, label, tokenThreshold, "bairro");
    return {
      bairro_anchor_ok: anchorOk,
      bairro_gate: "EXACT",
      bairro_canonico: label,
      bairro_canonico_key: keyExact,
      bairro_score: 1,
      bairro_token_score: 1,
      bairro_seq_ratio: 1,
      bairro_tokens_query: sc.q_tokens,
      bairro_tokens_ref: sc.r_tokens,
    };
  }

  // Fuzzy match
  let bestKey = "";
  let bestScore = 0;
  let bestTokenScore = 0;
  let bestSeqRatio = 0;
  let bestQTok = "";
  let bestRTok = "";

  for (const [bk] of bairroIndex) {
    const label = keyToLabel.get(bk) || bk;
    const sc = scoreComponents(bairroCandidato, label, tokenThreshold, "bairro");
    if (sc.score_final > bestScore) {
      bestScore = sc.score_final;
      bestKey = bk;
      bestTokenScore = sc.token_score;
      bestSeqRatio = sc.seq_ratio;
      bestQTok = sc.q_tokens;
      bestRTok = sc.r_tokens;
    }
  }

  const gate = bestScore >= bairroFuzzyThreshold ? "FUZZY" : "FAIL";
  const anchorOk = gate !== "FAIL" && bairroClassificacao === "OK";
  const label = bestKey ? (keyToLabel.get(bestKey) || "") : "";

  return {
    bairro_anchor_ok: anchorOk,
    bairro_gate: gate,
    bairro_canonico: label,
    bairro_canonico_key: bestKey,
    bairro_score: bestScore,
    bairro_token_score: bestTokenScore,
    bairro_seq_ratio: bestSeqRatio,
    bairro_tokens_query: bestQTok,
    bairro_tokens_ref: bestRTok,
  };
}

// ══════════════════════════════════════════════════
//  PHASE 3: LOGRADOURO MATCH (mirroring Python)
// ══════════════════════════════════════════════════

function _extractViaNumLetter(s: string): [string, string] {
  const norm = normTextKeepNumbers(s || "");
  const toks = norm.split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    if (STREET_TYPES.has(toks[i]) && i + 1 < toks.length) {
      const cand = toks[i + 1];
      if (/^\d+[A-Z]?$/.test(cand)) {
        const m = cand.match(/^(\d+)([A-Z]?)$/);
        if (m) return [m[1], m[2] || ""];
      }
    }
  }
  return ["", ""];
}

interface LogradouroMatchResult {
  match_ok: boolean;
  score: number;
  token_score: number;
  seq_ratio: number;
  q_tokens: string;
  r_tokens: string;
  matched: CepRecord | null;
  top1: number;
  top2: number;
  gap: number;
  review_status: string;
  review_reason: string;
}

function matchLogradouroInCandidates(
  qLogradouro: string,
  candidates: CepRecord[],
  minScore: number,
  tokenThreshold: number,
  ambiguousGap: number,
): LogradouroMatchResult {
  const emptyResult: LogradouroMatchResult = {
    match_ok: false, score: 0, token_score: 0, seq_ratio: 0, q_tokens: "", r_tokens: "",
    matched: null, top1: 0, top2: 0, gap: 0,
    review_status: "REVIEW", review_reason: "SEM_CANDIDATOS",
  };
  if (!qLogradouro || !candidates.length) return emptyResult;

  const [qNum, qLetter] = _extractViaNumLetter(qLogradouro);

  const scored: Array<{
    sFinal: number; sJ: number; sR: number; qTok: string; rTok: string; record: CepRecord;
  }> = [];

  for (const ref of candidates) {
    const sc = scoreComponents(qLogradouro, ref.logradouro, tokenThreshold, "logradouro");
    const [rNum, rLetter] = _extractViaNumLetter(ref.logradouro);

    let adjust = 0;
    if (qNum && rNum && qNum === rNum) {
      if (qLetter && rLetter) {
        adjust = qLetter === rLetter ? 0.03 : -0.05;
      } else if (qLetter && !rLetter) {
        adjust = -0.05;
      } else if (!qLetter && rLetter) {
        adjust = -0.03;
      } else {
        adjust = 0.02;
      }
    }

    const finalScore = Math.max(0, Math.min(1, sc.score_final + adjust));
    scored.push({
      sFinal: finalScore, sJ: sc.token_score, sR: sc.seq_ratio,
      qTok: sc.q_tokens, rTok: sc.r_tokens, record: ref,
    });
  }

  scored.sort((a, b) => b.sFinal - a.sFinal);

  const top1 = scored[0];
  const top2 = scored.length > 1 ? scored[1] : null;
  const top2Score = top2 ? top2.sFinal : 0;
  const gap = top2 ? top1.sFinal - top2Score : top1.sFinal;

  const ok = top1.sFinal >= minScore;

  let reviewStatus = "";
  let reviewReason = "";

  if (ok && top2 && gap < ambiguousGap) {
    reviewStatus = "REVIEW";
    reviewReason = "AMBIGUO_TOP2_PROXIMO";
  }
  if (!ok) {
    reviewStatus = "REVIEW";
    reviewReason = "LOGRADOURO_SCORE_BAIXO";
  }

  return {
    match_ok: ok,
    score: top1.sFinal,
    token_score: top1.sJ,
    seq_ratio: top1.sR,
    q_tokens: top1.qTok,
    r_tokens: top1.rTok,
    matched: ok || (reviewReason === "AMBIGUO_TOP2_PROXIMO") ? top1.record : null,
    top1: top1.sFinal,
    top2: top2Score,
    gap,
    review_status: reviewStatus,
    review_reason: reviewReason,
  };
}

// ══════════════════════════════════════════════════
//  FULL PIPELINE (mirroring Python pipeline_match_endereco)
// ══════════════════════════════════════════════════

function parseCidadeUf(cidade: string): { cidade: string; uf: string } {
  if (!cidade) return { cidade: "", uf: "" };
  const parts = cidade.split(/\s*\/\s*/);
  if (parts.length >= 2) {
    return { cidade: parts.slice(0, -1).join(" ").trim(), uf: parts[parts.length - 1].trim() };
  }
  return { cidade: cidade.trim(), uf: "" };
}

interface MatchConfig {
  bairro_fuzzy_threshold: number;
  min_score_logradouro: number;
  token_threshold: number;
  ambiguous_gap: number;
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
  bairro_token_score: number;
  bairro_seq_ratio: number;
  bairro_tokens_query: string;
  bairro_tokens_ref: string;
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

function processRow(
  endereco: string,
  cepBase: CepRecord[],
  bairroIndex: Map<string, CepRecord[]>,
  keyToLabel: Map<string, string>,
  config: MatchConfig,
): MatchResult {
  const parts = parseEndereco(endereco);
  const numero = parts.numero || extractNumeroEndereco(endereco);

  const binfo = normalizeBairroRules(parts.bairro);
  const bairroClassificacao = binfo.bairro_classificacao;
  const bairroNormalizado = binfo.bairro_normalizado;
  const bairroComplemento = binfo.bairro_complemento;
  const bairroCandidato = bairroNormalizado || parts.bairro;

  const qLog = parts.logradouro || preprocessForMatch(endereco);

  // Phase 2: Bairro resolution
  const bairroRes = resolveBairroPagador(
    bairroCandidato, bairroClassificacao, bairroIndex, keyToLabel,
    config.token_threshold, config.bairro_fuzzy_threshold,
  );

  let reviewStatus = "";
  let reviewReason = "";

  if (bairroClassificacao === "REVISAR") {
    reviewStatus = "REVIEW";
    reviewReason = "BAIRRO_REVISAR";
  } else if (bairroClassificacao === "RUIDO" || bairroClassificacao === "COMPLEMENTO") {
    reviewStatus = "REVIEW";
    reviewReason = `BAIRRO_${bairroClassificacao}`;
  } else if (!parts.bairro.trim()) {
    reviewStatus = "REVIEW";
    reviewReason = "BAIRRO_VAZIO";
  }

  let logResult: LogradouroMatchResult;

  if (bairroRes.bairro_anchor_ok) {
    const candidates = bairroIndex.get(bairroRes.bairro_canonico_key) || [];
    logResult = matchLogradouroInCandidates(qLog, candidates, config.min_score_logradouro, config.token_threshold, config.ambiguous_gap);
  } else {
    if (!reviewStatus) {
      reviewStatus = "REVIEW";
      reviewReason = "BAIRRO_NAO_ANCOROU_NA_BASE";
    }

    if (config.fallback_global) {
      logResult = matchLogradouroInCandidates(qLog, cepBase, config.min_score_logradouro, config.token_threshold, config.ambiguous_gap);
      logResult.review_status = "REVIEW";
      logResult.review_reason = logResult.review_reason
        ? `${reviewReason} + ${logResult.review_reason}`
        : reviewReason;
    } else {
      logResult = {
        match_ok: false, score: 0, token_score: 0, seq_ratio: 0, q_tokens: "", r_tokens: "",
        matched: null, top1: 0, top2: 0, gap: 0,
        review_status: reviewStatus, review_reason: reviewReason,
      };
    }
  }

  // Override review if bairro had issues
  if (reviewStatus && logResult.review_status !== "REVIEW") {
    logResult.review_status = reviewStatus;
    logResult.review_reason = reviewReason;
  }

  const matchedNumero = logResult.match_ok ? numero : "";
  let matchedEnderecoCompleto = "";
  if (logResult.match_ok && logResult.matched) {
    const partsFull: string[] = [];
    if (logResult.matched.logradouro) partsFull.push(logResult.matched.logradouro.trim());
    if (matchedNumero) partsFull.push(matchedNumero);
    if (logResult.matched.bairro) partsFull.push(logResult.matched.bairro.trim());
    matchedEnderecoCompleto = partsFull.filter(Boolean).join(" ").trim();
  }

  const cidadeUf = parseCidadeUf(logResult.matched?.cidade || "");

  return {
    endereco_usado: endereco || "",
    parsed_logradouro: parts.logradouro,
    parsed_numero: numero,
    parsed_bairro: parts.bairro,
    bairro_classificacao: bairroClassificacao,
    bairro_normalizado: bairroNormalizado,
    bairro_complemento: bairroComplemento,
    bairro_candidato: bairroCandidato,
    bairro_gate: bairroRes.bairro_anchor_ok ? bairroRes.bairro_gate : (config.fallback_global && !bairroRes.bairro_anchor_ok ? "GLOBAL_FALLBACK" : bairroRes.bairro_gate),
    bairro_anchor_ok: bairroRes.bairro_anchor_ok,
    bairro_score: bairroRes.bairro_score,
    bairro_token_score: bairroRes.bairro_token_score,
    bairro_seq_ratio: bairroRes.bairro_seq_ratio,
    bairro_tokens_query: bairroRes.bairro_tokens_query,
    bairro_tokens_ref: bairroRes.bairro_tokens_ref,
    bairro_canonico: bairroRes.bairro_canonico,
    bairro_canonico_key: bairroRes.bairro_canonico_key,
    logradouro_score: logResult.score,
    logradouro_token_score: logResult.token_score,
    logradouro_seq_ratio: logResult.seq_ratio,
    top1_score: logResult.top1,
    top2_score: logResult.top2,
    top1_top2_gap: logResult.gap,
    match_ok: logResult.match_ok,
    matched_logradouro: logResult.matched?.logradouro || "",
    matched_numero: matchedNumero,
    matched_bairro: logResult.matched?.bairro || "",
    matched_cep: logResult.matched?.cep || "",
    matched_cidade: cidadeUf.cidade,
    matched_uf: cidadeUf.uf || logResult.matched?.uf || "",
    matched_endereco_completo: matchedEnderecoCompleto,
    review_status: logResult.review_status,
    review_reason: logResult.review_reason,
  };
}

// ══════════════════════════════════════════════════
//  PHONE MATCH (mirroring Python)
// ══════════════════════════════════════════════════

function normNamePhone(s: string): string {
  s = stripAccents(s).toUpperCase();
  s = s.replace(/[^A-Z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function tokenListPhone(s: string): string[] {
  return normNamePhone(s).split(/\s+/).filter(Boolean);
}

function tokenJaccardPhone(a: string, b: string): number {
  const ta = new Set(tokenListPhone(a));
  const tb = new Set(tokenListPhone(b));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function seqRatioPhone(a: string, b: string): number {
  const na = normNamePhone(a);
  const nb = normNamePhone(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const m = na.length;
  const n = nb.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (na[i - 1] === nb[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / (m + n);
}

function scoreNamePhone(a: string, b: string): number {
  const tj = tokenJaccardPhone(a, b);
  const sr = seqRatioPhone(a, b);
  let base = 0.55 * tj + 0.45 * sr;
  const aTokens = tokenListPhone(a);
  const bTokens = tokenListPhone(b);
  if (aTokens.length > 0 && bTokens.length > 0) {
    const firstSim = tokenSim(aTokens[0], bTokens[0]);
    if (firstSim < 0.70) base -= 0.12;
  }
  return Math.max(0, Math.min(1, base));
}

function normPhoneDigits(p: string): string {
  let digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

function formatPhoneE164(p: string): string {
  const digits = normPhoneDigits(p);
  if (!digits) return "";
  return `+55${digits}`;
}

interface ContactEntry {
  name: string;
  phone: string;
  dup_count: number;
  dup_phones: string;
}

function parseContacts(data: unknown): ContactEntry[] {
  let arr: Record<string, unknown>[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.contacts)) arr = d.contacts as Record<string, unknown>[];
    else arr = [d];
  }

  const grouped = new Map<string, Array<{ name: string; phone: string; isMy: boolean }>>();
  for (const c of arr) {
    let name = String(c.saved_name || c.public_name || "").trim();
    name = name.replace(/\s+(26|2026)\s*$/, "");
    const phone = String(c.formatted_phone || c.phone_number || "").trim();
    if (!name || !phone) continue;
    const key = normNamePhone(name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ name, phone, isMy: !!c.is_my_contact });
  }

  const rows: ContactEntry[] = [];
  for (const [, items] of grouped) {
    items.sort((a, b) => (b.isMy ? 1 : 0) - (a.isMy ? 1 : 0));
    const phoneCounts = new Map<string, number>();
    for (const it of items) {
      phoneCounts.set(it.phone, (phoneCounts.get(it.phone) || 0) + 1);
    }
    const phonesSorted = [...phoneCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const preferredPhone = phonesSorted.length > 0 ? phonesSorted[0][0] : "";
    const preferredName = items[0].name;
    const uniquePhones = [...new Set(items.map(i => i.phone))].sort();
    rows.push({
      name: preferredName,
      phone: preferredPhone,
      dup_count: items.length,
      dup_phones: uniquePhones.join(" | "),
    });
  }
  return rows;
}

interface PhoneMatchConfig {
  name_column: string;
  phone_column: string;
  threshold: number;
  overwrite: boolean;
}

function applyPhoneMatch(
  rows: Record<string, unknown>[],
  contacts: ContactEntry[],
  cfg: PhoneMatchConfig,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const nome = String(row[cfg.name_column] || "").trim();
    if (!nome) {
      return { ...row, phone_match_status: "SEM_NOME" };
    }

    let bestS = 0;
    let bestC: ContactEntry | null = null;
    for (const c of contacts) {
      const s = scoreNamePhone(nome, c.name);
      if (s > bestS) { bestS = s; bestC = c; }
    }

    if (!bestC) {
      return { ...row, phone_match_status: "SEM_MATCH" };
    }

    const out: Record<string, unknown> = {
      ...row,
      phone_match_score: bestS.toFixed(3),
      phone_match_name: bestC.name,
      phone_match_phone: bestC.phone,
      phone_match_dup_count: bestC.dup_count,
      phone_match_dup_phones: bestC.dup_phones,
    };

    const currentPhone = String(row[cfg.phone_column] || "").trim();
    const hasPhone = !!currentPhone;
    const currentNorm = normPhoneDigits(currentPhone);
    const bestNorm = normPhoneDigits(bestC.phone);

    if (bestS >= cfg.threshold) {
      if (!hasPhone || cfg.overwrite) {
        out[cfg.phone_column] = formatPhoneE164(bestC.phone);
        out.phone_match_status = bestC.dup_count > 1 ? "ATUALIZADO_DUPLICADO" : "ATUALIZADO";
      } else {
        if (currentNorm && bestNorm && currentNorm !== bestNorm) {
          out.Telefone_secundario = formatPhoneE164(bestC.phone);
          out.phone_match_status = "TELEFONE_SECUNDARIO";
        } else {
          out[cfg.phone_column] = formatPhoneE164(currentPhone);
          out.phone_match_status = "JA_TINHA_TELEFONE";
        }
      }
    } else {
      out.phone_match_status = "ABAIXO_THRESHOLD";
    }

    return out;
  });
}

// ══════════════════════════════════════════════════
//  EDGE FUNCTION HANDLER — CHUNKED (sync per batch)
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
      payers_csv,
      ceps_csv,
      use_db_ceps,
      config: userConfig,
      endereco_column,
      // Phone match (only on final batch)
      contacts_json,
      phone_match_config,
      // Batch mode: if cep_base is provided, skip DB fetch
      cep_base_prefetched,
      is_phone_only,
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
      fallback_global: userConfig?.fallback_global ?? false,
    };

    // Phone-only mode: just apply phone match and return
    if (is_phone_only && contacts_json) {
      const contacts = parseContacts(contacts_json);
      const pmCfg: PhoneMatchConfig = {
        name_column: (phone_match_config?.name_column as string) || "Nome",
        phone_column: (phone_match_config?.phone_column as string) || "Telefone",
        threshold: (phone_match_config?.threshold as number) ?? 0.86,
        overwrite: (phone_match_config?.overwrite as boolean) ?? false,
      };
      const results = applyPhoneMatch(payers_csv, contacts, pmCfg);
      let updated = 0, secondary = 0, below = 0;
      for (const r of results) {
        const st = String(r.phone_match_status || "");
        if (st === "ATUALIZADO" || st === "ATUALIZADO_DUPLICADO") updated++;
        else if (st === "TELEFONE_SECUNDARIO") secondary++;
        else if (st === "ABAIXO_THRESHOLD") below++;
      }
      return new Response(
        JSON.stringify({ results, phone_summary: { total: contacts.length, updated, secondary, below } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build CEP base
    let cepBase: CepRecord[] = [];

    if (cep_base_prefetched && Array.isArray(cep_base_prefetched) && cep_base_prefetched.length > 0) {
      // Reuse prefetched base from previous call
      cepBase = cep_base_prefetched as CepRecord[];
    } else {
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
    }

    if (cepBase.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma base de CEPs disponível" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bairroIndex = buildBairroIndex(cepBase);
    const keyToLabel = buildKeyToLabel(cepBase);
    const endCol = endereco_column || "Endereco";

    // Process this batch of payers
    const results = payers_csv.map((row: Record<string, unknown>) => {
      const endereco = String(row[endCol] || "");
      const matchResult = processRow(endereco, cepBase, bairroIndex, keyToLabel, config);
      return { ...row, ...matchResult };
    });

    return new Response(
      JSON.stringify({
        results,
        cep_base_size: cepBase.length,
        bairro_index_size: bairroIndex.size,
        // Return the cep_base so frontend can send it back for next batches
        cep_base: cepBase,
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
