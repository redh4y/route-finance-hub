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

// Payer CSV row type
export interface PayerCSVRow {
  Nome?: string;
  Identif?: string;
  "Cod Pagador"?: string;
  Endereco?: string;
  CEP?: string;
  Cidade?: string;
  UF?: string;
  Telefone?: string;
  Email?: string;
  // Matched fields from pre-processing
  matched_uf?: string;
  match_ok?: string;
  matched_logradouro?: string;
  parsed_numero?: string;
  matched_bairro?: string;
  matched_cep?: string;
  matched_cidade?: string;
  matched_full?: string;
  review_status?: string;
  review_reason?: string;
}

// Billing CSV row type
export interface BillingCSVRow {
  "Nosso Numero"?: string;
  "Seu Numero"?: string;
  "Cod Pagador"?: string;
  "Data Vencimento"?: string;
  Valor?: string;
  "Data Baixa"?: string;
  "Data Pagamento"?: string;
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

// Transform payer CSV row to database format
export function transformPayerRow(row: PayerCSVRow) {
  const documentDigits = normalizeCPF(row.Identif);
  const payerCode = row["Cod Pagador"]?.trim() || null;
  const id = documentDigits || payerCode;

  if (!id || !row.Nome?.trim()) {
    return null;
  }

  const matchOk = row.match_ok?.toLowerCase() === "true";

  return {
    id,
    name: row.Nome.trim(),
    name_lower: row.Nome.trim().toLowerCase(),
    document: row.Identif?.trim() || null,
    document_digits: documentDigits,
    payer_code: payerCode,
    address_original: row.Endereco?.trim() || null,
    phone: row.Telefone?.trim() || null,
    email: row.Email?.trim() || null,
    match_ok: matchOk,
    review_status: row.review_status?.trim() || null,
    review_reason: row.review_reason?.trim() || null,
    review_flag: !matchOk,
    // Only set address fields if match_ok is true
    ...(matchOk && {
      street: row.matched_logradouro?.trim() || null,
      number: row.parsed_numero?.trim() || null,
      neighborhood: row.matched_bairro?.trim() || null,
      cep: row.matched_cep?.trim() || row.CEP?.trim() || null,
      city: row.matched_cidade?.trim() || row.Cidade?.trim() || null,
      state: row.matched_uf?.trim() || row.UF?.trim() || null,
      address_base: row.matched_full?.trim() || null,
    }),
  };
}

// Transform billing CSV row to database format
export function transformBillingRow(row: BillingCSVRow) {
  const payerCode = row["Cod Pagador"]?.trim();
  const nossoNumero = row["Nosso Numero"]?.trim();
  
  if (!payerCode) {
    return null;
  }

  const dueDate = parseCSVDate(row["Data Vencimento"]);
  const liquidationAt = parseCSVDate(row["Data Baixa"]);
  const settlementAt = parseCSVDate(row["Data Pagamento"]);
  const amountCents = parseCSVCurrency(row.Valor);
  const seuNumero = row["Seu Numero"]?.trim() || null;

  const status = determineBillingStatus(liquidationAt, settlementAt);
  const referenceMonth = getBillingReferenceMonth(dueDate, seuNumero);

  return {
    payer_code: payerCode,
    nosso_numero: nossoNumero || null,
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
    route: isPreviousMonthReissue(seuNumero) ? "REEMISSAO" : "BOLETO",
  };
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
