import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ═══════════════════════════════════════════════════════════
   Google Drive helpers
   ═══════════════════════════════════════════════════════════ */

async function driveGet(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API ${res.status}: ${text}`);
  }
  return res;
}

async function listPdfFiles(token: string, folderId: string) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,webContentLink)&pageSize=1000&orderBy=name`;
  const res = await driveGet(token, url);
  const data = await res.json();
  return (data.files || []) as Array<{
    id: string;
    name: string;
    webViewLink?: string;
    webContentLink?: string;
  }>;
}

async function getFolderName(
  token: string,
  folderId: string
): Promise<string> {
  try {
    const res = await driveGet(
      token,
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`
    );
    const d = await res.json();
    return d.name || "";
  } catch {
    return "";
  }
}

/**
 * Extrai texto de um PDF usando Google Drive OCR:
 * 1. Copia o PDF como Google Doc (dispara OCR interno)
 * 2. Exporta o Doc como texto puro
 * 3. Deleta o Doc temporário
 */
async function extractTextViaDriveOcr(
  token: string,
  fileId: string
): Promise<string> {
  const copyRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/copy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mimeType: "application/vnd.google-apps.document",
        name: `_temp_ocr_${Date.now()}`,
      }),
    }
  );
  if (!copyRes.ok) {
    const err = await copyRes.text();
    throw new Error(`OCR copy failed: ${err}`);
  }
  const copy = await copyRes.json();
  try {
    // Retry export up to 4 times with increasing delay — OCR conversion may not be ready immediately
    const delays = [1500, 3000, 5000, 8000];
    let lastErr = "Export as text failed";
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }
      const textRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${copy.id}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (textRes.ok) return await textRes.text();
      const errText = await textRes.text().catch(() => "");
      lastErr = `Export as text failed (attempt ${attempt + 1}): ${textRes.status} ${errText.slice(0, 200)}`;
    }
    throw new Error(lastErr);
  } finally {
    await fetch(`https://www.googleapis.com/drive/v3/files/${copy.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
   Boleto parsing — ported from boleto_drive_processor.py
   ═══════════════════════════════════════════════════════════ */

function normalizeSpaces(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function stripAccents(text: string): string {
  return (text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForSearch(text: string): string {
  let t = stripAccents(text).toUpperCase();
  t = t.replace(/\xa0/g, " ");
  t = t.replace(/[\t\r]+/g, " ");
  t = t.replace(/\s+/g, " ");
  return t;
}

function toMoneyFloat(v: string): number {
  const raw = (v || "").trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(raw);
  return isNaN(n) ? -1 : n;
}

function formatCpf(cpfRaw: string): string {
  const digits = (cpfRaw || "").replace(/\D/g, "");
  return digits.length === 11 ? digits : "";
}

function cleanNomePagador(nome: string): string {
  let n = normalizeSpaces(nome);
  if (!n) return "";
  n = n.replace(
    /^(PAGADOR|SACADO|NOME\s+DO\s+PAGADOR)\s*[:\-]?\s*/i,
    ""
  );
  n = n.replace(/\s*-\s*(CPF|CNPJ)\s*[:\-]?\s*\d.*$/i, "");
  n = n.replace(/\b(CPF|CNPJ)\b\s*[:\-]?\s*\d.*$/i, "");
  return normalizeSpaces(n);
}

const NOISE_TERMS = [
  "CORTE NA LINHA ABAIXO",
  "CORTE AQUI",
  "RECIBO DO PAGADOR",
  "FICHA DE COMPENSACAO",
  "DESCONT",
  "ABATIMENT",
  "QUANTIDADE",
  "MOEDA",
  "ESPECIE",
  "CARTEIRA",
  "NOSSO NUMERO",
  "NUMERO DOCUMENTO",
  "USO DO BANCO",
  "AGENCIA",
  "CODIGO BENEFICIARIO",
  "BENEFICIARIO",
  "CEDENTE",
  "SACADOR",
  "AUTENTICACAO",
  "LOCAL DE PAGAMENTO",
  "DATA DOCUMENTO",
  "PROCESSAMENTO",
  "PARCELA",
  "INSTRUCOES",
  "PAGAVEL",
  "BANCO",
  "VALOR DOCUMENTO",
  "VALOR COBRADO",
  "JUROS",
  "MULTA",
  "VALOR",
  "DOCUMENTO",
  "PAGAMENTO",
  "LINHA DIGITAVEL",
];

function nomeLooksLikeNoise(nome: string): boolean {
  const n = normalizeForSearch(nome);
  if (!n || n.length < 6) return true;
  return NOISE_TERMS.some((t) => n.includes(t));
}

function sanitizeFilename(name: string): string {
  let n = (name || "").replace(/[\\/*?:"<>|]/g, "");
  n = normalizeSpaces(n);
  return n.slice(0, 180);
}

/* ─── Field extraction (mirrors Python logic) ─── */

function findLinhaDigitavel(texto: string): string {
  const text = normalizeSpaces(texto);
  const patterns = [
    /\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/,
    /\b\d{47}\b/,
    /\b\d{48}\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].replace(/\D/g, "");
  }
  return "";
}

function findNossoNumero(texto: string): string {
  const t = normalizeForSearch(texto);
  const m = t.match(
    /NOSSO\s+NUMERO\s*[:\-]?\s*([0-9]{2,}[0-9/\-]{3,})/i
  );
  if (m) return normalizeSpaces(m[1]);

  const m2 = texto.match(/\b\d{2}\/\d{5,8}-\d\b/);
  return m2 ? m2[0] : "";
}

function findValor(texto: string): string {
  const tNorm = normalizeForSearch(texto);

  // Labeled patterns (highest priority)
  const labeledPatterns = [
    /VALOR\s+(?:DO\s+)?DOCUMENTO\s*[:=\-]?\s*R?\$?\s*([\d.]{1,12},\d{2})/i,
    /VALOR\s+COBRADO\s*[:=\-]?\s*R?\$?\s*([\d.]{1,12},\d{2})/i,
    /\(=\)\s*VALOR\s+(?:DO\s+)?DOCUMENTO\s*[:=\-]?\s*R?\$?\s*([\d.]{1,12},\d{2})/i,
  ];
  const candidates: string[] = [];
  for (const p of labeledPatterns) {
    const matches = tNorm.matchAll(new RegExp(p.source, p.flags + "g"));
    for (const m of matches) candidates.push(m[1]);
  }
  if (candidates.length) {
    candidates.sort((a, b) => toMoneyFloat(b) - toMoneyFloat(a));
    return candidates[0];
  }

  // Lines containing VALOR + DOCUMENTO
  for (const linha of texto.split("\n")) {
    const ln = normalizeForSearch(linha);
    if (ln.includes("VALOR") && ln.includes("DOCUMENTO")) {
      const vals = [...linha.matchAll(/([\d.]{1,12},\d{2})/g)].map(
        (m) => m[1]
      );
      if (vals.length) {
        vals.sort((a, b) => toMoneyFloat(b) - toMoneyFloat(a));
        return vals[0];
      }
    }
  }

  // Fallback: largest monetary value
  const allVals = [...texto.matchAll(/\b([\d.]{1,12},\d{2})\b/g)].map(
    (m) => m[1]
  );
  if (allVals.length) {
    allVals.sort((a, b) => toMoneyFloat(b) - toMoneyFloat(a));
    return allVals[0];
  }
  return "";
}

function findVencimento(texto: string): string {
  const t = normalizeForSearch(texto);
  const labeled = [
    /VENCIMENTO\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/,
    /DATA\s+DE\s+VENCIMENTO\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const p of labeled) {
    const m = t.match(p);
    if (m) return m[1];
  }
  const m2 = t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  return m2 ? m2[1] : "";
}

/* ─── Name + CPF extraction (multi-strategy, mirrors Python) ─── */

function findNameNearCpf(
  linhas: string[]
): { nome: string; cpf: string } {
  const cpfPat = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})\b/;
  const labelPat = /\b(PAGADOR|SACADO|NOME DO PAGADOR)\b/i;

  for (let i = 0; i < linhas.length; i++) {
    const cpfM = linhas[i].match(cpfPat);
    if (!cpfM) continue;
    const cpf = formatCpf(cpfM[1]);
    if (!cpf) continue;

    for (
      let j = Math.max(0, i - 3);
      j < Math.min(linhas.length, i + 4);
      j++
    ) {
      let cand = linhas[j];
      if (labelPat.test(cand)) {
        cand = cand.replace(
          /^.*\b(PAGADOR|SACADO|NOME\s+DO\s+PAGADOR)\b\s*[:\-]?\s*/i,
          ""
        );
      }
      cand = cand.replace(
        /\b(CPF|CNPJ)\b\s*[:\-]?\s*\d.*$/i,
        ""
      );
      cand = cand.replace(
        /\s*-\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}).*$/,
        ""
      );
      cand = cleanNomePagador(cand);
      if (cand.split(/\s+/).length >= 2 && !nomeLooksLikeNoise(cand)) {
        return { nome: cand, cpf };
      }
    }
  }
  return { nome: "", cpf: "" };
}

function extractNameCpfFromFilename(
  fileName: string
): { nome: string; cpf: string } {
  const base = (fileName || "")
    .replace(/\.pdf$/i, "")
    .trim();
  const m = base.match(/(.+?)\s*-\s*(\d{11})$/);
  if (!m) return { nome: "", cpf: "" };
  const nome = cleanNomePagador(m[1]);
  const cpf = formatCpf(m[2]);
  if (!nome || nomeLooksLikeNoise(nome)) return { nome: "", cpf };
  return { nome, cpf };
}

function findNomeCpf(texto: string): { nome: string; cpf: string } {
  const linhas = texto
    .split("\n")
    .map((l) => normalizeSpaces(l))
    .filter(Boolean);

  // Strategy 1: "NOME - CPF" on same line
  for (const linha of linhas) {
    // With CPF/CNPJ label
    const mLabel = linha.match(
      /([A-ZÀ-Ý][A-ZÀ-Ý\s]{6,})\s*-\s*(?:CPF|CNPJ)\s*[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i
    );
    if (mLabel) {
      const nome = cleanNomePagador(mLabel[1]);
      const cpf = formatCpf(mLabel[2]);
      if (nome && cpf && !nomeLooksLikeNoise(nome)) return { nome, cpf };
    }

    // Without label
    const m = linha.match(
      /([A-ZÀ-Ý][A-ZÀ-Ý\s]{6,})\s*-\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i
    );
    if (m) {
      const nome = cleanNomePagador(m[1]);
      const cpf = formatCpf(m[2]);
      if (nome && cpf && !nomeLooksLikeNoise(nome)) return { nome, cpf };
    }
  }

  // Strategy 2: Proximity to PAGADOR/SACADO labels
  const labels = new Set(["PAGADOR", "SACADO", "NOME DO PAGADOR"]);
  for (let i = 0; i < linhas.length; i++) {
    const ln = normalizeForSearch(linhas[i]);
    if (![...labels].some((lbl) => ln.includes(lbl))) continue;

    const janela = linhas.slice(Math.max(0, i - 2), i + 6);
    const joined = janela.join(" | ");

    const cpfMatch = joined.match(
      /(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/
    );
    const cpf = cpfMatch ? formatCpf(cpfMatch[1]) : "";

    let nome = "";
    for (const cand of janela) {
      // If line contains the label, extract what comes after
      if (/\b(PAGADOR|SACADO)\b/i.test(cand)) {
        let candAfter = cand.replace(
          /^.*\b(PAGADOR|SACADO)\b\s*[:\-]?\s*/i,
          ""
        );
        candAfter = candAfter
          .replace(
            /\s*-\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}).*$/,
            ""
          )
          .trim();
        candAfter = cleanNomePagador(candAfter);
        if (
          candAfter.split(/\s+/).length >= 2 &&
          !nomeLooksLikeNoise(candAfter)
        ) {
          nome = candAfter;
          break;
        }
      }

      const candNorm = normalizeForSearch(cand);
      if ([...labels].some((lbl) => candNorm.includes(lbl))) continue;

      let cleaned = cand;
      if (/\d{11}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(cleaned)) {
        cleaned = cleaned
          .replace(
            /\s*-?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}).*/,
            ""
          )
          .replace(/[\s\-]+$/, "");
      }
      cleaned = cleanNomePagador(cleaned);
      if (
        cleaned.split(/\s+/).length >= 2 &&
        !/VENCIMENTO|VALOR|AGENCIA|DOCUMENTO/.test(
          normalizeForSearch(cleaned)
        ) &&
        !nomeLooksLikeNoise(cleaned)
      ) {
        nome = normalizeSpaces(cleaned);
        break;
      }
    }

    if (nome || cpf) return { nome, cpf };
  }

  // Strategy 3: CPF detected → find name nearby
  const ctx = findNameNearCpf(linhas);
  if (ctx.nome || ctx.cpf) return ctx;

  // Strategy 4: Explicit PAGADOR ... CPF/CNPJ pattern
  const flat = normalizeSpaces(texto);
  const explicitPatterns = [
    /PAGADOR\s*[:\-]?\s*([A-ZÀ-Ý][A-ZÀ-Ý\s]{6,}?)\s+(?:CPF|CNPJ)\s*[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i,
    /SACADO\s*[:\-]?\s*([A-ZÀ-Ý][A-ZÀ-Ý\s]{6,}?)\s+(?:CPF|CNPJ)\s*[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11})/i,
  ];
  for (const p of explicitPatterns) {
    const m = flat.match(p);
    if (m) {
      const nome = cleanNomePagador(m[1]);
      const cpf = formatCpf(m[2]);
      if (nome && !nomeLooksLikeNoise(nome)) return { nome, cpf };
    }
  }

  return { nome: "", cpf: "" };
}

/** Full boleto field extraction combining all strategies */
function parseBoletoFields(
  text: string,
  fileName: string
): {
  payer_name: string;
  payer_cpf: string;
  our_number: string;
  digitable_line: string;
  amount: string;
  due_date: string;
} {
  const { nome, cpf } = findNomeCpf(text);
  let payerName = cleanNomePagador(nome);
  let payerCpf = cpf;

  // Fallback: extract from filename pattern "NOME - 12345678901.pdf"
  if (!payerName || nomeLooksLikeNoise(payerName)) {
    const fromFile = extractNameCpfFromFilename(fileName);
    if (fromFile.nome) payerName = fromFile.nome;
    if (!payerCpf && fromFile.cpf) payerCpf = fromFile.cpf;
  }

  return {
    payer_name: payerName,
    payer_cpf: payerCpf,
    our_number: findNossoNumero(text),
    digitable_line: findLinhaDigitavel(text),
    amount: findValor(text),
    due_date: findVencimento(text),
  };
}

/* ═══════════════════════════════════════════════════════════
   Drive file operations
   ═══════════════════════════════════════════════════════════ */

async function renameFile(
  token: string,
  fileId: string,
  newName: string
) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    }
  );
  return res.ok;
}

async function deleteFile(token: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.ok;
}

async function uploadJsonToDrive(
  token: string,
  folderId: string,
  jsonText: string,
  folderName: string
) {
  const safeName =
    (folderName || "pasta_sem_nome")
      .replace(/[^A-Za-z0-9._\- ]/g, "_")
      .trim() || "pasta_sem_nome";
  const fileName = `00_boletos_${safeName}.json`;

  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false and name='${fileName.replace(/'/g, "\\'")}'`
  );
  const listRes = await driveGet(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`
  );
  const listData = await listRes.json();
  const existing = listData.files?.[0];

  if (existing) {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: jsonText,
      }
    );
    return existing.id;
  }

  const boundary = "---lovable-boundary---";
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
  });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    jsonText,
    `--${boundary}--`,
  ].join("\r\n");

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const created = await createRes.json();
  return created.id;
}

/* ═══════════════════════════════════════════════════════════
   Single-file processing helper (reused by process_file & process_batch)
   ═══════════════════════════════════════════════════════════ */

async function processSingleFile(
  access_token: string,
  file: { id: string; name: string },
  flags?: DriveProcessorFlags
) {
  const skipPat = /\s-\s\d{11}\.pdf$/i;

  if (flags?.skip_already_renamed && skipPat.test(file.name)) {
    return {
      read_source: "",
      payer_name: "",
      payer_cpf: "",
      our_number: "",
      digitable_line: "",
      amount: "",
      due_date: "",
      original_file_name: file.name,
      final_file_name: file.name,
      file_id: file.id,
      download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
      view_link: `https://drive.google.com/file/d/${file.id}/view`,
      success: true,
      error: "SKIPPED_ALREADY_RENAMED",
    };
  }

  let text = "";
  const readSource = "google_ocr";
  const debugLog: string[] = [];

  try {
    if (flags?.debug_mode) {
      debugLog.push(`[DEBUG][FILE] id=${file.id}`);
      debugLog.push(`[DEBUG][FILE] nome_original=${file.name}`);
    }

    text = await extractTextViaDriveOcr(access_token, file.id);

    if (flags?.debug_mode) {
      debugLog.push(`[DEBUG][LEITURA] tamanho_texto=${text.trim().length}`);
    }
  } catch (e) {
    return {
      read_source: "error",
      payer_name: "",
      payer_cpf: "",
      our_number: "",
      digitable_line: "",
      amount: "",
      due_date: "",
      original_file_name: file.name,
      final_file_name: file.name,
      file_id: file.id,
      download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
      view_link: `https://drive.google.com/file/d/${file.id}/view`,
      success: false,
      error: `OCR falhou: ${(e as Error).message}`,
    };
  }

  const parsed = parseBoletoFields(text, file.name);

  if (flags?.debug_mode) {
    debugLog.push(`[DEBUG][CAMPOS] nosso_numero=${parsed.our_number}`);
    debugLog.push(`[DEBUG][CAMPOS] linha_digitavel=${parsed.digitable_line}`);
    debugLog.push(`[DEBUG][CAMPOS] valor=${parsed.amount}`);
    debugLog.push(`[DEBUG][CAMPOS] vencimento=${parsed.due_date}`);
    debugLog.push(`[DEBUG][NOME_CPF] nome=${JSON.stringify(parsed.payer_name)}`);
    debugLog.push(`[DEBUG][NOME_CPF] cpf=${JSON.stringify(parsed.payer_cpf)}`);
  }

  let finalName = file.name;
  if (flags?.rename_files !== false && parsed.payer_name && parsed.payer_cpf) {
    const safeName = sanitizeFilename(
      `${parsed.payer_name.toUpperCase()} - ${parsed.payer_cpf}.pdf`
    );
    if (safeName && safeName !== file.name) {
      try {
        await renameFile(access_token, file.id, safeName);
        finalName = safeName;
        if (flags?.debug_mode) debugLog.push("[DEBUG][RENOMEAR] aplicado=true");
      } catch {
        finalName = file.name;
        if (flags?.debug_mode) debugLog.push("[DEBUG][RENOMEAR] aplicado=false erro=true");
      }
    }
  } else if (flags?.debug_mode) {
    debugLog.push("[DEBUG][RENOMEAR] aplicado=false motivo='nome/cpf insuficientes ou desabilitado'");
  }

  return {
    read_source: readSource,
    payer_name: parsed.payer_name,
    payer_cpf: parsed.payer_cpf,
    our_number: parsed.our_number,
    digitable_line: parsed.digitable_line,
    amount: parsed.amount,
    due_date: parsed.due_date,
    original_file_name: file.name,
    final_file_name: finalName,
    file_id: file.id,
    download_link: `https://drive.google.com/uc?export=download&id=${file.id}`,
    view_link: `https://drive.google.com/file/d/${file.id}/view`,
    success: true,
    error: null,
    ...(flags?.debug_mode ? { debug_full_text: text, debug_log: debugLog } : {}),
  };
}

type DriveProcessorFlags = {
  rename_files?: boolean;
  skip_already_renamed?: boolean;
  debug_mode?: boolean;
  save_json_on_drive?: boolean;
};

/* ═══════════════════════════════════════════════════════════
   Main handler
   ═══════════════════════════════════════════════════════════ */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, access_token, folder_id, flags } = body;

    if (!access_token) {
      return new Response(
        JSON.stringify({ error: "access_token do Google é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: unknown;

    switch (action) {
      /* ─── Listar PDFs ─── */
      case "list_pdfs": {
        const files = await listPdfFiles(access_token, folder_id);
        const folderName = await getFolderName(access_token, folder_id);
        result = { files, folder_name: folderName };
        break;
      }

      /* ─── Nome da pasta ─── */
      case "get_folder_name": {
        result = { name: await getFolderName(access_token, folder_id) };
        break;
      }

      /* ─── Processar um arquivo (helper) ─── */
      case "process_file": {
        const file = body.file as { id: string; name: string };
        result = await processSingleFile(access_token, file, flags);
        break;
      }

      /* ─── Processar lote de arquivos em paralelo ─── */
      case "process_batch": {
        const files = body.files as { id: string; name: string }[];
        const concurrency = Math.min(body.concurrency || 5, 8);
        const batchResults: unknown[] = [];

        // Process in chunks of `concurrency`
        for (let i = 0; i < files.length; i += concurrency) {
          const chunk = files.slice(i, i + concurrency);
          const chunkResults = await Promise.allSettled(
            chunk.map((file) => processSingleFile(access_token, file, flags))
          );
          for (let j = 0; j < chunkResults.length; j++) {
            const cr = chunkResults[j];
            if (cr.status === "fulfilled") {
              batchResults.push(cr.value);
            } else {
              batchResults.push({
                read_source: "error",
                payer_name: "",
                payer_cpf: "",
                our_number: "",
                digitable_line: "",
                amount: "",
                due_date: "",
                original_file_name: chunk[j].name,
                final_file_name: chunk[j].name,
                file_id: chunk[j].id,
                download_link: "",
                view_link: "",
                success: false,
                error: cr.reason?.message || "Erro desconhecido",
              });
            }
          }
        }
        result = { results: batchResults };
        break;
      }

      /* ─── Deletar arquivos ─── */
      case "delete_files": {
        const fileIds = body.file_ids as string[];
        const deleted: string[] = [];
        const errors: string[] = [];
        for (const fid of fileIds || []) {
          try {
            const ok = await deleteFile(access_token, fid);
            if (ok) deleted.push(fid);
            else errors.push(`${fid}: delete returned false`);
          } catch (e) {
            errors.push(`${fid}: ${(e as Error).message}`);
          }
        }
        result = { deleted, errors };
        break;
      }

      /* ─── Upload JSON ─── */
      case "upload_json": {
        const jsonText = body.json_text as string;
        const folderName = await getFolderName(access_token, folder_id);
        const fileId = await uploadJsonToDrive(
          access_token,
          folder_id,
          jsonText,
          folderName
        );
        result = { success: true, file_id: fileId };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("boleto-drive-processor error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
