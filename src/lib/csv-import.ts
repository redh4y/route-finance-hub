import Papa from "papaparse";

// Normalize CPF to 11 digits with leading zeros
export function normalizeCPF(doc: string | null | undefined): string | null {
  if (!doc) return null;
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits.padStart(11, "0").slice(-11);
}

// Check if "Seu Número" indicates a previous month reissue
export function isPreviousMonthReissue(seuNumero: string | null | undefined): boolean {
  if (!seuNumero) return false;
  const upper = seuNumero.toUpperCase();
  return upper.includes("ANT") || upper.includes("ANTERIOR");
}

// Parse date from CSV (handles multiple formats)
export function parseCSVDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try DD/MM/YYYY format
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  // Try YYYY-MM-DD format (already ISO)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  return null;
}

// Parse currency value from CSV
export function parseCSVCurrency(value: string | null | undefined): number {
  if (!value) return 0;
  const cleaned = value
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// Determine billing status based on dates
export function determineBillingStatus(
  liquidationAt: string | null, // Data Baixa
  settlementAt: string | null   // Data Pagamento
): "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW" {
  const hasLiquidation = !!liquidationAt;
  const hasSettlement = !!settlementAt;

  if (hasLiquidation && hasSettlement) {
    return "NEEDS_REVIEW";
  }
  if (hasSettlement) {
    return "PAID";
  }
  if (hasLiquidation) {
    return "CANCELADO";
  }
  return "OPEN";
}

// Get reference month for billing (handles reissue logic)
export function getBillingReferenceMonth(
  dueDate: string | null,
  seuNumero: string | null
): string {
  if (!dueDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  const date = new Date(dueDate);
  let year = date.getFullYear();
  let month = date.getMonth() + 1;

  // If it's a reissue (ANT/ANTERIOR), use previous month
  if (isPreviousMonthReissue(seuNumero)) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

// Parse CSV file
export function parseCSV<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parse warnings:", results.errors);
        }
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

// Status priority for conflict resolution
const STATUS_PRIORITY = {
  PAID: 3,
  OPEN: 2,
  NEEDS_REVIEW: 1,
  CANCELADO: 0,
};

export function getHigherPriorityStatus(
  status1: keyof typeof STATUS_PRIORITY,
  status2: keyof typeof STATUS_PRIORITY
): keyof typeof STATUS_PRIORITY {
  return STATUS_PRIORITY[status1] >= STATUS_PRIORITY[status2] ? status1 : status2;
}

// Validate CPF using algorithm
export function validateCPF(cpf: string | null): boolean {
  if (!cpf) return false;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

// Payer CSV row type - Complete mapping from CSV headers
export interface PayerCSVRow {
  // Main identification fields
  Nome?: string;
  Identif?: string;
  "Cod Pagador"?: string;
  
  // Original address fields
  Endereco?: string;
  CEP?: string;
  Cidade?: string;
  UF?: string;
  
  // Contact fields
  Telefone?: string;
  Telefone_secundario?: string;
  Email?: string;
  
  // Phone matching fields (from pre-processing)
  phone_match_score?: string;
  phone_match_name?: string;
  phone_match_phone?: string;
  phone_match_dup_count?: string;
  phone_match_dup_phones?: string;
  phone_match_status?: string;
  
  // Document validation
  identif_dup_flag?: string;
  Cep_original?: string;
  
  // Address matching fields (from pre-processing)
  match_ok?: string;
  match_score?: string;
  logradouro_score?: string;
  logradouro_token_score?: string;
  logradouro_seq_ratio?: string;
  text_full_score?: string;
  endereco_tokens?: string;
  ref_tokens?: string;
  
  // Matched address components
  matched_cep?: string;
  matched_cidade?: string;
  matched_logradouro?: string;
  matched_bairro?: string;
  matched_full?: string;
  matched_uf?: string;
  matched_numero?: string;
  matched_endereco_completo?: string;
  
  // Parsed address components
  parsed_logradouro?: string;
  parsed_numero?: string;
  parsed_bairro?: string;
  endereco_usado?: string;
  
  // Bairro matching details
  bairro_anchor_ok?: string;
  bairro_gate?: string;
  bairro_classificacao?: string;
  bairro_normalizado?: string;
  bairro_complemento?: string;
  bairro_candidato?: string;
  bairro_canonico?: string;
  bairro_canonico_key?: string;
  bairro_score?: string;
  bairro_token_score?: string;
  bairro_seq_ratio?: string;
  bairro_tokens_query?: string;
  bairro_tokens_ref?: string;
  
  // Review fields
  top1_score?: string;
  top2_score?: string;
  top1_top2_gap?: string;
  review_status?: string;
  review_reason?: string;
}

// Billing CSV row type - Complete mapping from CSV headers
export interface BillingCSVRow {
  // Main identification
  "Nosso Numero"?: string;
  "Seu Numero"?: string;
  "Cod Pagador"?: string;
  "Cpf/Cnpj Pagador"?: string;
  
  // Dates
  "Data Vencimento"?: string;
  "Data Baixa"?: string;      // liquidationAt - indicates cancellation
  "Data Pagamento"?: string;  // settlementAt - indicates payment
  
  // Values
  Valor?: string;
  "Valor Titulo"?: string;
  "Valor Documento"?: string;
  
  // Payer info (for placeholder creation)
  "Nome Pagador"?: string;
  Nome?: string;
}

// CEP CSV row type
export interface CEPCSVRow {
  CEP?: string;
  Logradouro?: string;
  Bairro?: string;
  Cidade?: string;
  UF?: string;
}

// Transform payer CSV row to database format with complete business rules
export function transformPayerRow(row: PayerCSVRow) {
  const documentDigits = normalizeCPF(row.Identif);
  const payerCode = row["Cod Pagador"]?.trim() || null;
  const id = documentDigits || payerCode;

  if (!id || !row.Nome?.trim()) {
    return null;
  }

  const matchOk = row.match_ok?.toLowerCase() === "true";
  const documentValid = validateCPF(documentDigits);
  
  // Determine review flag based on multiple conditions
  const reviewStatus = row.review_status?.trim() || null;
  const reviewReason = row.review_reason?.trim() || null;
  const reviewFlag = !matchOk || 
    reviewStatus === "REVIEW" || 
    (reviewReason?.includes("AMBIGUO_TOP2_PROXIMO") ?? false);
  
  // Build extra contacts array if secondary phone exists
  const extraContacts: Array<{ type: string; value: string }> = [];
  if (row.Telefone_secundario?.trim()) {
    extraContacts.push({ type: "phone", value: row.Telefone_secundario.trim() });
  }

  // Base payer object - always saved fields
  // Note: name_lower is a generated column in the database, so we don't include it
  const basePayer = {
    id,
    name: row.Nome.trim(),
    document: row.Identif?.trim() || null,
    document_digits: documentDigits,
    document_valid: documentValid,
    payer_code: payerCode,
    address_original: row.Endereco?.trim() || null,
    phone: row.Telefone?.trim() || null,
    email: row.Email?.trim() || null,
    match_ok: matchOk,
    review_status: reviewStatus,
    review_reason: reviewReason,
    review_flag: reviewFlag,
    review_address: !matchOk,
    extra_contacts: extraContacts.length > 0 ? extraContacts : null,
  };

  // Only add matched address fields if match_ok is true
  if (matchOk) {
    return {
      ...basePayer,
      street: row.matched_logradouro?.trim() || null,
      number: row.parsed_numero?.trim() || row.matched_numero?.trim() || null,
      neighborhood: row.matched_bairro?.trim() || null,
      cep: row.matched_cep?.trim() || row.CEP?.trim() || null,
      city: row.matched_cidade?.trim() || row.Cidade?.trim() || null,
      state: row.matched_uf?.trim() || row.UF?.trim() || null,
      address_base: row.matched_full?.trim() || row.matched_endereco_completo?.trim() || null,
    };
  }

  return basePayer;
}

// Transform billing CSV row to database format with complete business rules
export function transformBillingRow(row: BillingCSVRow) {
  // Try to get payer identification from multiple fields
  const documentDigits = normalizeCPF(row["Cpf/Cnpj Pagador"]);
  const payerCode = row["Cod Pagador"]?.trim() || null;
  const payerId = documentDigits || payerCode;
  
  if (!payerId) {
    return null;
  }

  const nossoNumero = row["Nosso Numero"]?.trim() || null;
  const seuNumero = row["Seu Numero"]?.trim() || null;
  
  const dueDate = parseCSVDate(row["Data Vencimento"]);
  const liquidationAt = parseCSVDate(row["Data Baixa"]);
  const settlementAt = parseCSVDate(row["Data Pagamento"]);
  
  // Try multiple value fields
  const amountCents = parseCSVCurrency(row.Valor) || 
    parseCSVCurrency(row["Valor Titulo"]) || 
    parseCSVCurrency(row["Valor Documento"]);

  const status = determineBillingStatus(liquidationAt, settlementAt);
  const referenceMonth = getBillingReferenceMonth(dueDate, seuNumero);
  const isReissue = isPreviousMonthReissue(seuNumero);
  
  // Get payer name for placeholder creation
  const payerName = row["Nome Pagador"]?.trim() || row.Nome?.trim() || null;

  return {
    payer_id: payerId,
    payer_code: payerCode,
    payer_name: payerName, // Used for creating placeholder payers
    nosso_numero: nossoNumero,
    seu_numero: seuNumero,
    due_date: dueDate,
    liquidation_at: liquidationAt,
    settlement_at: settlementAt,
    amount_expected_cents: amountCents,
    amount_paid_cents: status === "PAID" ? amountCents : null,
    status,
    reference_month: referenceMonth,
    payment_method: "BOLETO",
    source: "IMPORT",
    route: isReissue ? "REEMISSAO" : "BOLETO",
  };
}

// Check if cancellation was quick (within 10 days of due date)
export function isQuickCancellation(dueDate: string | null, liquidationAt: string | null): boolean {
  if (!dueDate || !liquidationAt) return false;
  
  const due = new Date(dueDate);
  const liquidation = new Date(liquidationAt);
  const diffDays = Math.abs((liquidation.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  
  return diffDays <= 10;
}

// Transform CEP CSV row to database format
export function transformCEPRow(row: CEPCSVRow) {
  const cep = row.CEP?.replace(/\D/g, "");
  if (!cep || cep.length !== 8) {
    return null;
  }

  return {
    cep,
    logradouro: row.Logradouro?.trim() || null,
    bairro: row.Bairro?.trim() || null,
    cidade: row.Cidade?.trim() || null,
    uf: row.UF?.trim()?.toUpperCase() || null,
  };
}
