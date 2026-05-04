/**
 * Phone Match Engine — client-side fuzzy name matching for phone contacts.
 * Ported from Python: token_jaccard + seq_ratio scoring.
 */

// ══════════════════════════════════════════════════
//  TEXT NORMALIZATION
// ══════════════════════════════════════════════════

function stripAccents(s: string): string {
  return (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normNamePhone(s: string): string {
  s = stripAccents(s).toUpperCase();
  s = s.replace(/[^A-Z0-9 ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function tokenListPhone(s: string): string[] {
  return normNamePhone(s).split(" ").filter(Boolean);
}

// ══════════════════════════════════════════════════
//  SCORING FUNCTIONS
// ══════════════════════════════════════════════════

function tokenJaccardPhone(a: string, b: string): number {
  const ta = new Set(tokenListPhone(a));
  const tb = new Set(tokenListPhone(b));
  if (ta.size === 0 && tb.size === 0) return 1.0;
  if (ta.size === 0 || tb.size === 0) return 0.0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

/**
 * SequenceMatcher ratio equivalent (longest common subsequence based).
 * Uses a simplified approach matching Python's difflib.SequenceMatcher.ratio().
 */
function seqRatioPhone(a: string, b: string): number {
  const na = normNamePhone(a);
  const nb = normNamePhone(b);
  if (!na && !nb) return 1.0;
  if (!na || !nb) return 0.0;

  // LCS-based ratio like Python's SequenceMatcher
  const matches = countMatchingChars(na, nb);
  return (2.0 * matches) / (na.length + nb.length);
}

/**
 * Count matching characters using longest common subsequence approach.
 * Approximates Python difflib SequenceMatcher behavior.
 */
function countMatchingChars(a: string, b: string): number {
  // Use the standard matching blocks approach
  return findMatchingBlocks(a, b);
}

function findMatchingBlocks(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // Find longest common substring
  let bestLen = 0;
  let bestI = 0;
  let bestJ = 0;

  // Optimized: use a rolling approach
  const m = a.length;
  const n = b.length;

  // For performance with long strings, use a simpler LCS approach
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > bestLen) {
          bestLen = curr[j];
          bestI = i - bestLen;
          bestJ = j - bestLen;
        }
      } else {
        curr[j] = 0;
      }
    }
    prev.set(curr);
    curr.fill(0);
  }

  if (bestLen === 0) return 0;

  // Recursively find matches in the parts before and after the best match
  const leftA = a.slice(0, bestI);
  const leftB = b.slice(0, bestJ);
  const rightA = a.slice(bestI + bestLen);
  const rightB = b.slice(bestJ + bestLen);

  return bestLen + findMatchingBlocks(leftA, leftB) + findMatchingBlocks(rightA, rightB);
}

function seqRatioTokens(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const matches = findMatchingBlocks(a, b);
  return (2.0 * matches) / (a.length + b.length);
}

export function scoreNamePhone(a: string, b: string): number {
  const tj = tokenJaccardPhone(a, b);
  const sr = seqRatioPhone(a, b);
  let base = 0.55 * tj + 0.45 * sr;

  const aTokens = tokenListPhone(a);
  const bTokens = tokenListPhone(b);
  if (aTokens.length > 0 && bTokens.length > 0) {
    const firstSim = seqRatioTokens(aTokens[0], bTokens[0]);
    if (firstSim < 0.70) {
      base -= 0.12;
    }
  }

  return Math.max(0.0, Math.min(1.0, base));
}

// ══════════════════════════════════════════════════
//  PHONE NORMALIZATION
// ══════════════════════════════════════════════════

export function normPhoneDigits(p: string): string {
  let digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

export function formatPhoneE164(p: string): string {
  const digits = normPhoneDigits(p);
  if (!digits) return "";
  return `+55${digits}`;
}

// ══════════════════════════════════════════════════
//  CONTACT READING & GROUPING
// ══════════════════════════════════════════════════

export interface RawContact {
  saved_name?: string;
  public_name?: string;
  formatted_phone?: string;
  phone_number?: string;
  is_my_contact?: boolean;
  is_business?: boolean;
  labels?: string[];
  country_code?: string;
}

export interface GroupedContact {
  name: string;
  phone: string;
  dup_count: number;
  dup_phones: string;
  /** Other contact names that share the same primary phone number */
  phone_shared_with: string;
}

export function readJsonContacts(raw: RawContact[]): GroupedContact[] {
  let data: RawContact[] = raw;
  if (!Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    if (d && typeof d === "object" && "contacts" in d && Array.isArray((d as any).contacts)) {
      data = (d as any).contacts;
    } else {
      data = [d as RawContact];
    }
  }

  const grouped = new Map<string, { name: string; phone: string; is_my_contact: boolean }[]>();

  for (const c of data) {
    let name = (c.saved_name || c.public_name || "").trim();
    // Remove trailing year suffixes like " 26", " 2026", " 25", " 2025", etc.
    name = name.replace(/\s+(?:20[2-9]\d|[2-9]\d)\s*$/, "");
    const phone = (c.formatted_phone || c.phone_number || "").trim();
    if (!name || !phone) continue;

    const key = normNamePhone(name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({
      name,
      phone,
      is_my_contact: !!c.is_my_contact,
    });
  }

  const rows: GroupedContact[] = [];
  for (const [, items] of grouped) {
    // Sort: is_my_contact first
    items.sort((a, b) => (b.is_my_contact ? 1 : 0) - (a.is_my_contact ? 1 : 0));
    const phones = items.map((i) => i.phone);
    // Count and sort phones by frequency
    const phoneCounts = new Map<string, number>();
    for (const p of phones) {
      phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    }
    const phonesSorted = Array.from(phoneCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const preferredPhone = phonesSorted.length > 0 ? phonesSorted[0][0] : "";
    const preferredName = items[0].name;
    const uniquePhones = Array.from(new Set(phones)).sort();

    rows.push({
      name: preferredName,
      phone: preferredPhone,
      dup_count: phones.length,
      dup_phones: uniquePhones.join(" | "),
      phone_shared_with: "", // populated below
    });
  }

  // Build reverse index: normalized phone → contact names
  const phoneToNames = new Map<string, string[]>();
  for (const row of rows) {
    const norm = normPhoneDigits(row.phone);
    if (!norm) continue;
    if (!phoneToNames.has(norm)) phoneToNames.set(norm, []);
    phoneToNames.get(norm)!.push(row.name);
  }

  // Populate phone_shared_with for contacts whose phone is shared with others
  for (const row of rows) {
    const norm = normPhoneDigits(row.phone);
    const names = phoneToNames.get(norm) || [];
    const others = names.filter((n) => n !== row.name);
    row.phone_shared_with = others.join(" | ");
  }

  return rows;
}

// ══════════════════════════════════════════════════
//  PHONE MATCH ENGINE
// ══════════════════════════════════════════════════

export type PhoneMatchStatus =
  | "ATUALIZADO"
  | "ATUALIZADO_DUPLICADO"
  | "JA_TINHA_TELEFONE"
  | "TELEFONE_SECUNDARIO"
  | "ABAIXO_THRESHOLD"
  | "SEM_NOME"
  | "SEM_MATCH";

export interface PhoneMatchRow {
  phone_match_score: string;
  phone_match_name: string;
  phone_match_phone: string;
  phone_match_dup_count: string;
  phone_match_dup_phones: string;
  phone_match_status: PhoneMatchStatus | "";
  telefone_secundario: string;
  /** Other contact names that share the same phone number */
  phone_shared_names: string;
  /** The final phone to use (updated or original) */
  phone_final: string;
}

export interface PhoneMatchConfig {
  threshold: number;
  overwrite: boolean;
}

/**
 * Apply phone match to a set of payer rows.
 * Returns an array of PhoneMatchRow results, one per input row (same order).
 */
export function applyPhoneMatch(
  rows: Record<string, unknown>[],
  contacts: GroupedContact[],
  nameCol: string,
  phoneCol: string,
  config: PhoneMatchConfig,
  onProgress?: (processed: number, total: number) => void,
): PhoneMatchRow[] {
  const results: PhoneMatchRow[] = [];
  const total = rows.length;

  for (let idx = 0; idx < total; idx++) {
    const row = rows[idx];
    const nome = String(row[nameCol] || "").trim();

    if (idx % 100 === 0 && onProgress) {
      onProgress(idx, total);
    }

    if (!nome) {
      results.push(emptyResult("SEM_NOME", ""));
      continue;
    }

    // Score all contacts
    let bestScore = 0;
    let bestContact: GroupedContact | null = null;
    for (const c of contacts) {
      const s = scoreNamePhone(nome, c.name);
      if (s > bestScore) {
        bestScore = s;
        bestContact = c;
      }
    }

    if (!bestContact) {
      results.push(emptyResult("SEM_MATCH", ""));
      continue;
    }

    const currentPhone = String(row[phoneCol] || "").trim();
    const hasPhone = !!currentPhone;
    const currentPhoneNorm = normPhoneDigits(currentPhone);
    const bestPhoneNorm = normPhoneDigits(bestContact.phone);

    let status: PhoneMatchStatus;
    let phoneFinal = currentPhone ? formatPhoneE164(currentPhone) : "";
    let telSecundario = "";

    if (bestScore >= config.threshold) {
      if (!hasPhone || config.overwrite) {
        phoneFinal = formatPhoneE164(bestContact.phone);
        status = bestContact.dup_count > 1 ? "ATUALIZADO_DUPLICADO" : "ATUALIZADO";
      } else {
        // Has phone and not overwriting
        if (currentPhoneNorm && bestPhoneNorm && currentPhoneNorm !== bestPhoneNorm) {
          telSecundario = formatPhoneE164(bestContact.phone);
          status = "TELEFONE_SECUNDARIO";
        } else {
          phoneFinal = formatPhoneE164(currentPhone);
          status = "JA_TINHA_TELEFONE";
        }
      }
    } else {
      status = "ABAIXO_THRESHOLD";
    }

    results.push({
      phone_match_score: bestScore.toFixed(3),
      phone_match_name: bestContact.name,
      phone_match_phone: bestContact.phone,
      phone_match_dup_count: String(bestContact.dup_count),
      phone_match_dup_phones: bestContact.dup_phones,
      phone_match_status: status,
      telefone_secundario: telSecundario,
      phone_shared_names: bestContact.phone_shared_with,
      phone_final: phoneFinal,
    });
  }

  if (onProgress) onProgress(total, total);
  return results;
}

function emptyResult(status: PhoneMatchStatus, phoneFinal: string): PhoneMatchRow {
  return {
    phone_match_score: "",
    phone_match_name: "",
    phone_match_phone: "",
    phone_match_dup_count: "",
    phone_match_dup_phones: "",
    phone_match_status: status,
    telefone_secundario: "",
    phone_shared_names: "",
    phone_final: phoneFinal,
  };
}
