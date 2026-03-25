/**
 * Address Match Engine — client-side fuzzy matching
 * Migrated from edge function to avoid CPU limits.
 */

// ══════════════════════════════════════════════════
//  CONSTANTS
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
//  TEXT NORMALIZATION
// ══════════════════════════════════════════════════

function stripAccents(s: string): string {
  return (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function _normalizeNumMarkers(s: string): string {
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
  s = s.replace(/\b(\d+)\s+([A-MO-Z])\b/g, "$1$2");
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
  s = s.replace(/\b(\d+)\s+([A-MO-Z])\b/g, "$1$2");
  s = s.replace(/\bAV(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bR(\d+[A-Z]?)\b/g, "RUA $1");
  s = s.replace(/\bAVENIDA(\d+[A-Z]?)\b/g, "AVENIDA $1");
  s = s.replace(/\bRUA(\d+[A-Z]?)\b/g, "RUA $1");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function preprocessForMatch(s: string): string {
  s = normText(s);
  s = s.replace(/\b(?:N|NO|NR|NUM|NUMERO)\s*\d+[A-Z]?\b/g, " ");
  const toks = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let prev = "";
  for (const t of toks) {
    const isNum = /^\d+[A-Z]?$/.test(t);
    if (isNum) {
      if (STREET_TYPES.has(prev)) out.push(t);
    } else {
      out.push(t);
    }
    prev = t;
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// ══════════════════════════════════════════════════
//  SIMILARITY (optimized single-row DP)
// ══════════════════════════════════════════════════

function lcsRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const lenRatio = m > n ? n / m : m / n;
  if (lenRatio < 0.4) return lenRatio;
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) curr[j] = prev[j - 1] + 1;
      else curr[j] = prev[j] > curr[j - 1] ? prev[j] : curr[j - 1];
    }
    prev.set(curr);
    curr.fill(0);
  }
  return (2 * prev[n]) / (m + n);
}

function tokenSim(a: string, b: string): number {
  return lcsRatio(a, b);
}

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
      if (s > bestS) { bestS = s; bestI = i; }
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
  return lcsRatio(preprocessForMatch(a), preprocessForMatch(b));
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
  return {
    score_final: WEIGHT_JACCARD * sJ + WEIGHT_SEQ * sR,
    token_score: sJ,
    seq_ratio: sR,
    q_tokens: qToks.join(" "),
    r_tokens: rToks.join(" "),
  };
}

// ══════════════════════════════════════════════════
//  BAIRRO NORMALIZATION RULES
// ══════════════════════════════════════════════════

function _simNorm(a: string, b: string): number {
  return lcsRatio(normText(a), normText(b));
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

function _mapBairroAlias(rawNorm: string, aliases?: BairroAlias[]): [string | null, string | null] {
  // DB-driven aliases take priority; hardcoded rules are the fallback
  if (aliases && aliases.length > 0) {
    const result = applyBairroAliases(rawNorm, aliases);
    if (result[0] !== null) return result;
  }
  if (/\b(COAB|COHAB|CHOAB)\s*I\b/.test(rawNorm)) return ["Doutor Fábio Talarico", null];
  if (/\b(COAB|COHAB|CHOAB)\s*II\b/.test(rawNorm)) return ["Mario Garcia da Costa", null];
  if (/\bCOA?H?AB\s*1\b/.test(rawNorm) || /\bCOAB1\b/.test(rawNorm) || /\bCOHAB1\b/.test(rawNorm))
    return ["Doutor Fábio Talarico", null];
  if (/\bCOA?H?AB\s*2\b/.test(rawNorm) || /\bCOAB2\b/.test(rawNorm) || /\bCOHAB2\b/.test(rawNorm))
    return ["Mario Garcia da Costa", null];
  if (/\bMUTIRAO\s*1\b/.test(rawNorm) || /\bMUTIRAO1\b/.test(rawNorm))
    return ["Conjunto Habitacional Padre Mário Lano", null];
  if (/\bMUTIRAO\s*3\b/.test(rawNorm) || /\bMUTIRAO3\b/.test(rawNorm))
    return ["Etelvina Santana da Silva", null];
  if (rawNorm === "CECAP") return ["Conjunto Habitacional Geralda Geltrudes da Silva", null];
  if (rawNorm.includes("ELIZIO") || rawNorm.includes("CAMPOS ELIZIO") || rawNorm.includes("CAMPOS ELISA"))
    return ["Campos Elíseos", null];
  if (/\bJARDIM\s+ELISA\b/.test(rawNorm) || /\bJARDIM\s+ELIZA\b/.test(rawNorm) || /\bJD\s+ELIZA\b/.test(rawNorm))
    return ["Jardim Eliza", null];
  if (/\bELIZA\b/.test(rawNorm)) return ["Jardim Eliza", null];
  if (rawNorm.includes("ELI") && Math.max(_simNorm(rawNorm, "ELIZA"), _simNorm(rawNorm, "ELISA"), _simNorm(rawNorm, "JARDIM ELIZA")) >= 0.80)
    return ["Jardim Eliza", null];
  if (rawNorm.includes("JOAO VACARO") || rawNorm.includes("JOAO VACCARO") || rawNorm.includes("BAIRRO JOAO VACARO"))
    return ["João Vaccaro", null];
  if (rawNorm.includes("JOSE PUGLIESI") || rawNorm.includes("JOSE PUGLIESE"))
    return ["Conjunto Habitacional Prefeito José Pugliesi", null];
  if (rawNorm.includes("REINALDO STEIN") || rawNorm.includes("REYNALDO STEIN") || rawNorm.includes("REINALDO STEM"))
    return ["Residencial Reynaldo Stein", null];
  if (/\bVILLE\b/.test(rawNorm)) return ["Residencial Nobre Ville", null];
  if (rawNorm.includes("BOM JESUS")) return ["Vila São Bom Jesus Lapa", null];
  if (/\bNADIA\s*4\b/.test(rawNorm)) return ["Residencial Nadia 4", null];
  if (/\bNADIA\b/.test(rawNorm)) return ["Residencial Nadia", null];
  if (rawNorm.includes("SANTA ISABEL")) return ["Desmembramento Recreio Santa Isabel", null];
  if (rawNorm.trim() === "SAO FRANCISCO") return ["Jardim São Francisco I", null];
  if (rawNorm.includes("VIVENDAS")) return ["Vivendas do Bom Jardim", null];
  if (rawNorm.includes("TONICO GARCIA")) return ["Conjunto Residencial Antonio Garcia", null];
  if (rawNorm.includes("GUAIRA E") || rawNorm.includes("BAIRRO GUAIRA E"))
    return ["Conjunto Habitacional Gabriel Garcia de Carvalho", null];
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
  if (rawNorm.includes("MURAISHI")) {
    const tokens = rawNorm.split(/\s+/);
    let idx = tokens.indexOf("MURAISHI");
    if (idx >= 0) {
      let tail = tokens.slice(idx + 1);
      let normalized = "Residencial Muraishi";
      if (tail.length > 0) {
        if (tail[0] === "2" || tail[0] === "II") { normalized = "Residencial Muraishi II"; tail = tail.slice(1); }
        else if (tail[0] === "1" || tail[0] === "I") { tail = tail.slice(1); }
      }
      const comp = tail.length > 0 ? tail.join(" ").trim() : null;
      return [normalized, comp];
    }
  }
  if (rawNorm.includes("BANESPINHA")) return ["Residencial Antonio Nery Lopes", null];
  return [null, null];
}

interface BairroResult {
  bairro_classificacao: string;
  bairro_normalizado: string;
  bairro_complemento: string;
}

function normalizeBairroRules(bairroRaw: string, aliases?: BairroAlias[]): BairroResult {
  let raw = normText(bairroRaw || "");
  if (!raw) return { bairro_classificacao: "", bairro_normalizado: "", bairro_complemento: "" };
  raw = raw.replace(/^\bBAIRRO\b\s+/, "").trim();
  raw = raw.replace(/\bMURAUSHI\b/g, "MURAISHI");
  if (raw === "JARDIM" || raw === "JE") return { bairro_classificacao: "RUIDO", bairro_normalizado: "", bairro_complemento: "" };
  if (raw.includes("BANESPINHA")) return { bairro_classificacao: "OK", bairro_normalizado: "Residencial Antonio Nery Lopes", bairro_complemento: "" };
  if (raw === "CENTRO") return { bairro_classificacao: "OK", bairro_normalizado: "Centro", bairro_complemento: "" };
  if (raw.startsWith("CENTRO ")) {
    const complemento = raw.replace("CENTRO", "").trim();
    return { bairro_classificacao: "OK", bairro_normalizado: "Centro", bairro_complemento: complemento };
  }
  if (_hasComplementPattern(raw)) {
    const [bairroPart, complemento] = _splitBairroComplemento(raw);
    if (!bairroPart) return { bairro_classificacao: "COMPLEMENTO", bairro_normalizado: "", bairro_complemento: complemento || raw };
    const [mapped, comp2] = _mapBairroAlias(bairroPart, aliases);
    const mergedComp = _mergeComplement(complemento, comp2);
    if (mapped) return { bairro_classificacao: "OK", bairro_normalizado: mapped, bairro_complemento: mergedComp };
    return { bairro_classificacao: "OK", bairro_normalizado: _titleCaseKeepRoman(bairroPart), bairro_complemento: mergedComp };
  }
  const [mapped, comp] = _mapBairroAlias(raw, aliases);
  if (mapped) return { bairro_classificacao: "OK", bairro_normalizado: mapped, bairro_complemento: comp || "" };
  return { bairro_classificacao: "OK", bairro_normalizado: _titleCaseKeepRoman(raw), bairro_complemento: "" };
}

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
//  NUMBER EXTRACTION
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
      if (!STREET_TYPES.has(prev)) candidates.push(t);
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
//  ADDRESS PARSER
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
  let start = 0;
  if (!STREET_TYPES.has(toks[0])) {
    for (let i = 0; i < toks.length; i++) {
      if (STREET_TYPES.has(toks[i])) { start = i; break; }
    }
  }
  toks = toks.slice(start);
  if (!toks.length) return { logradouro: "", numero: "", bairro: "" };
  let numero = "";
  let idxMarker: number | null = null;
  for (let i = 0; i < toks.length; i++) {
    if (NUM_MARKERS.has(toks[i]) && i + 1 < toks.length && /^\d+[A-Z]?$/.test(toks[i + 1])) {
      numero = toks[i + 1]; idxMarker = i; break;
    }
  }
  let idxNumToken: number | null = null;
  if (!numero) {
    numero = extractNumeroEndereco(s);
    if (numero) {
      for (let i = 0; i < toks.length; i++) {
        if (toks[i] === numero) { idxNumToken = i; break; }
      }
    }
  }
  let logTokens: string[];
  let afterNumTokens: string[];
  if (idxMarker !== null) {
    logTokens = toks.slice(0, idxMarker);
    afterNumTokens = (idxMarker + 2 <= toks.length) ? toks.slice(idxMarker + 2) : [];
  } else if (idxNumToken !== null) {
    logTokens = toks.slice(0, idxNumToken);
    afterNumTokens = toks.slice(idxNumToken + 1);
  } else {
    if (toks.length >= 3 && STREET_TYPES.has(toks[0]) && /^\d+[A-Z]?$/.test(toks[1]) && looksLikeBairroToken(toks[2])) {
      logTokens = toks.slice(0, 2); afterNumTokens = toks.slice(2);
    } else {
      logTokens = toks.slice(0, Math.min(3, toks.length));
      afterNumTokens = toks.slice(Math.min(3, toks.length));
    }
  }
  const logradouro = logTokens.join(" ").trim();
  let bairroTokens = [...afterNumTokens];
  let hasBairroMarker = false;
  const bairroIdx = bairroTokens.indexOf("BAIRRO");
  if (bairroIdx >= 0) { bairroTokens = bairroTokens.slice(bairroIdx + 1); hasBairroMarker = true; }
  if (!hasBairroMarker) {
    for (let i = 0; i < bairroTokens.length; i++) {
      if (BAIRRO_ANCHORS.has(bairroTokens[i]) || looksLikeBairroToken(bairroTokens[i])) {
        bairroTokens = bairroTokens.slice(i); break;
      }
    }
  }
  return { logradouro, numero, bairro: bairroTokens.join(" ").trim() };
}

// ══════════════════════════════════════════════════
//  CEP / BAIRRO INDEX
// ══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
//  BAIRRO ALIASES (DB-driven)
// ══════════════════════════════════════════════════

export interface BairroAlias {
  id?: string;
  entrada: string;
  bairro_canonico: string;
  complemento?: string | null;
  match_type: "EXACT" | "CONTAINS";
  ordem?: number;
}

/**
 * Apply DB-driven bairro aliases to a normalized bairro string.
 * Sorts aliases by: ordem ascending, then entrada length descending (longer = more specific wins).
 * Returns [bairro_canonico, complemento] or [null, null] if no match.
 */
export function applyBairroAliases(rawNorm: string, aliases: BairroAlias[]): [string | null, string | null] {
  const sorted = [...aliases].sort((a, b) => {
    const oa = a.ordem ?? 100;
    const ob = b.ordem ?? 100;
    if (oa !== ob) return oa - ob;
    return b.entrada.length - a.entrada.length; // longer patterns first within same ordem
  });
  for (const alias of sorted) {
    const matched =
      alias.match_type === "EXACT"
        ? rawNorm.trim() === alias.entrada
        : rawNorm.includes(alias.entrada);
    if (matched) return [alias.bairro_canonico, alias.complemento ?? null];
  }
  return [null, null];
}

export interface CepRecord {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export function buildBairroIndex(ceps: CepRecord[]): Map<string, CepRecord[]> {
  const idx = new Map<string, CepRecord[]>();
  for (const c of ceps) {
    const key = normText(c.bairro || "");
    if (!key) continue;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push(c);
  }
  return idx;
}

export function buildKeyToLabel(ceps: CepRecord[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of ceps) {
    const key = normText(c.bairro || "");
    if (key && !m.has(key)) m.set(key, c.bairro);
  }
  return m;
}

// ══════════════════════════════════════════════════
//  BAIRRO RESOLUTION
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
    const sc = scoreComponents(bairroCandidato, label, tokenThreshold, "bairro");
    return {
      bairro_anchor_ok: bairroClassificacao === "OK",
      bairro_gate: "EXACT",
      bairro_canonico: label,
      bairro_canonico_key: keyExact,
      bairro_score: 1, bairro_token_score: 1, bairro_seq_ratio: 1,
      bairro_tokens_query: sc.q_tokens, bairro_tokens_ref: sc.r_tokens,
    };
  }
  let bestKey = "", bestScore = 0, bestTokenScore = 0, bestSeqRatio = 0, bestQTok = "", bestRTok = "";
  for (const [bk] of bairroIndex) {
    const label = keyToLabel.get(bk) || bk;
    const sc = scoreComponents(bairroCandidato, label, tokenThreshold, "bairro");
    if (sc.score_final > bestScore) {
      bestScore = sc.score_final; bestKey = bk;
      bestTokenScore = sc.token_score; bestSeqRatio = sc.seq_ratio;
      bestQTok = sc.q_tokens; bestRTok = sc.r_tokens;
    }
  }
  const gate = bestScore >= bairroFuzzyThreshold ? "FUZZY" : "FAIL";
  return {
    bairro_anchor_ok: gate !== "FAIL" && bairroClassificacao === "OK",
    bairro_gate: gate,
    bairro_canonico: bestKey ? (keyToLabel.get(bestKey) || "") : "",
    bairro_canonico_key: bestKey,
    bairro_score: bestScore, bairro_token_score: bestTokenScore, bairro_seq_ratio: bestSeqRatio,
    bairro_tokens_query: bestQTok, bairro_tokens_ref: bestRTok,
  };
}

// ══════════════════════════════════════════════════
//  LOGRADOURO MATCH
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
    matched: null, top1: 0, top2: 0, gap: 0, review_status: "REVIEW", review_reason: "SEM_CANDIDATOS",
  };
  if (!qLogradouro || !candidates.length) return emptyResult;
  const [qNum, qLetter] = _extractViaNumLetter(qLogradouro);
  const scored: Array<{ sFinal: number; sJ: number; sR: number; qTok: string; rTok: string; record: CepRecord }> = [];
  for (const ref of candidates) {
    const sc = scoreComponents(qLogradouro, ref.logradouro, tokenThreshold, "logradouro");
    const [rNum, rLetter] = _extractViaNumLetter(ref.logradouro);
    let adjust = 0;
    if (qNum && rNum && qNum === rNum) {
      if (qLetter && rLetter) adjust = qLetter === rLetter ? 0.03 : -0.05;
      else if (qLetter && !rLetter) adjust = -0.05;
      else if (!qLetter && rLetter) adjust = -0.03;
      else adjust = 0.02;
    }
    scored.push({
      sFinal: Math.max(0, Math.min(1, sc.score_final + adjust)),
      sJ: sc.token_score, sR: sc.seq_ratio, qTok: sc.q_tokens, rTok: sc.r_tokens, record: ref,
    });
  }
  scored.sort((a, b) => b.sFinal - a.sFinal);
  const top1 = scored[0];
  const top2 = scored.length > 1 ? scored[1] : null;
  const top2Score = top2 ? top2.sFinal : 0;
  const gap = top2 ? top1.sFinal - top2Score : top1.sFinal;
  const ok = top1.sFinal >= minScore;
  let reviewStatus = "", reviewReason = "";
  if (ok && top2 && gap < ambiguousGap) { reviewStatus = "REVIEW"; reviewReason = "AMBIGUO_TOP2_PROXIMO"; }
  if (!ok) { reviewStatus = "REVIEW"; reviewReason = "LOGRADOURO_SCORE_BAIXO"; }
  return {
    match_ok: ok, score: top1.sFinal, token_score: top1.sJ, seq_ratio: top1.sR,
    q_tokens: top1.qTok, r_tokens: top1.rTok,
    matched: ok || (reviewReason === "AMBIGUO_TOP2_PROXIMO") ? top1.record : null,
    top1: top1.sFinal, top2: top2Score, gap, review_status: reviewStatus, review_reason: reviewReason,
  };
}

// ══════════════════════════════════════════════════
//  FULL PIPELINE
// ══════════════════════════════════════════════════

function parseCidadeUf(cidade: string): { cidade: string; uf: string } {
  if (!cidade) return { cidade: "", uf: "" };
  const parts = cidade.split(/\s*\/\s*/);
  if (parts.length >= 2) return { cidade: parts.slice(0, -1).join(" ").trim(), uf: parts[parts.length - 1].trim() };
  return { cidade: cidade.trim(), uf: "" };
}

export interface MatchConfig {
  bairro_fuzzy_threshold: number;
  min_score_logradouro: number;
  token_threshold: number;
  ambiguous_gap: number;
  fallback_global: boolean;
}

export interface MatchResult {
  [key: string]: unknown;
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

export function processRow(
  endereco: string,
  cepBase: CepRecord[],
  bairroIndex: Map<string, CepRecord[]>,
  keyToLabel: Map<string, string>,
  config: MatchConfig,
  aliases?: BairroAlias[],
): MatchResult {
  const parts = parseEndereco(endereco);
  const numero = parts.numero || extractNumeroEndereco(endereco);
  const binfo = normalizeBairroRules(parts.bairro, aliases);
  const bairroCandidato = binfo.bairro_normalizado || parts.bairro;
  const qLog = parts.logradouro || preprocessForMatch(endereco);

  const bairroRes = resolveBairroPagador(
    bairroCandidato, binfo.bairro_classificacao, bairroIndex, keyToLabel,
    config.token_threshold, config.bairro_fuzzy_threshold,
  );

  let reviewStatus = "", reviewReason = "";
  if (binfo.bairro_classificacao === "REVISAR") { reviewStatus = "REVIEW"; reviewReason = "BAIRRO_REVISAR"; }
  else if (binfo.bairro_classificacao === "RUIDO" || binfo.bairro_classificacao === "COMPLEMENTO") {
    reviewStatus = "REVIEW"; reviewReason = `BAIRRO_${binfo.bairro_classificacao}`;
  } else if (!parts.bairro.trim()) { reviewStatus = "REVIEW"; reviewReason = "BAIRRO_VAZIO"; }

  let logResult: LogradouroMatchResult;
  if (bairroRes.bairro_anchor_ok) {
    const candidates = bairroIndex.get(bairroRes.bairro_canonico_key) || [];
    logResult = matchLogradouroInCandidates(qLog, candidates, config.min_score_logradouro, config.token_threshold, config.ambiguous_gap);
  } else {
    if (!reviewStatus) { reviewStatus = "REVIEW"; reviewReason = "BAIRRO_NAO_ANCOROU_NA_BASE"; }
    if (config.fallback_global) {
      logResult = matchLogradouroInCandidates(qLog, cepBase, config.min_score_logradouro, config.token_threshold, config.ambiguous_gap);
      logResult.review_status = "REVIEW";
      logResult.review_reason = logResult.review_reason ? `${reviewReason} + ${logResult.review_reason}` : reviewReason;
    } else {
      logResult = {
        match_ok: false, score: 0, token_score: 0, seq_ratio: 0, q_tokens: "", r_tokens: "",
        matched: null, top1: 0, top2: 0, gap: 0, review_status: reviewStatus, review_reason: reviewReason,
      };
    }
  }
  if (reviewStatus && logResult.review_status !== "REVIEW") {
    logResult.review_status = reviewStatus; logResult.review_reason = reviewReason;
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
    bairro_classificacao: binfo.bairro_classificacao,
    bairro_normalizado: binfo.bairro_normalizado,
    bairro_complemento: binfo.bairro_complemento,
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

/**
 * Process all rows client-side with progress callback.
 * Returns results synchronously in chunks via requestAnimationFrame to avoid UI freeze.
 */
export async function processAllRows(
  payersData: Record<string, unknown>[],
  cepBase: CepRecord[],
  enderecoCol: string,
  config: MatchConfig,
  onProgress?: (processed: number, total: number) => void,
  aliases?: BairroAlias[],
): Promise<Record<string, unknown>[]> {
  const bairroIndex = buildBairroIndex(cepBase);
  const keyToLabel = buildKeyToLabel(cepBase);
  const results: Record<string, unknown>[] = [];
  const CHUNK = 20; // process 20 rows per frame tick

  for (let i = 0; i < payersData.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, payersData.length);
    for (let j = i; j < end; j++) {
      const row = payersData[j];
      const endereco = String(row[enderecoCol] || "");
      const matchResult = processRow(endereco, cepBase, bairroIndex, keyToLabel, config, aliases);
      results.push({ ...row, ...matchResult });
    }
    onProgress?.(end, payersData.length);
    // Yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return results;
}
