export type ParsedInvoiceLine = {
  purchaseDate: string; // YYYY-MM-DD
  description: string;
  descriptionNorm: string;
  installmentCurrent: number;
  installmentTotal: number;
  amountCents: number;
};

export type BuildInput = {
  cardId: string;
  cardName?: string | null;
  provider?: "sicredi" | "generic";
  costCenterCode?: string;
  category?: string;
  invoiceMonthOverride: string; // YYYY-MM
  closingDay?: number; // day of month (1-31)
  dueDay?: number; // day of month (1-31)
  runId?: string | null;
};

export type InstallmentContract = {
  id: string;
  provider: string;
  card_id: string;
  card_name: string | null;
  purchase_date: string;
  merchant_base: string;
  installment_total: number;
  installment_amount_cents: number;
  run_id: string | null;
};

export type ExpenseEntry = {
  expense_id: string;
  contract_id: string;
  description: string;
  amount_cents: number;
  status: "REAL" | "PREVISTO";
  date: string; // YYYY-MM-DD (15th of invoice month)
  operation_date: string; // YYYY-MM-DD (real competence date)
  competence_month: string; // YYYY-MM
  invoice_month: string; // YYYY-MM (override)
  card_id: string | null;
  cost_center_code: string;
  category: string;
  subcategory: string | null;
  type: "DESPESA";
  source: "IMPORT";
  installments_total: number;
  installment_current?: number | null;
  installment_total?: number | null;
  parent_entry_id: string | null;
};

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateBR(value: string): string | null {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseInstallment(value: string): { current: number; total: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Only accept pure installment patterns like "01/03"
  const match = trimmed.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!match) return null;
  return { current: Number(match[1]), total: Number(match[2]) };
}

function parseCurrencyToCents(value: string): number | null {
  const cleaned = value
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function toMonthRef(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function toInvoiceDay15(monthRef: string): string {
  return `${monthRef}-15`;
}

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function parseInvoiceCsvRobust(rows: string[][]): ParsedInvoiceLine[] {
  const lines: ParsedInvoiceLine[] = [];

  for (const row of rows) {
    const cells = row.map((c) => String(c ?? "").trim()).filter((c) => c.length > 0);
    if (cells.length === 0) continue;

    let dateIso: string | null = null;
    let dateIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const parsed = parseDateBR(cells[i]);
      if (parsed) {
        dateIso = parsed;
        dateIdx = i;
        break;
      }
    }
    if (!dateIso || dateIdx === -1) continue;

    let description = "";
    for (let i = dateIdx + 1; i < cells.length; i++) {
      if (cells[i]) {
        description = cells[i];
        break;
      }
    }
    if (!description) continue;
    const descNorm = normalizeText(description);
    if (descNorm.includes("pag fat deb cc")) continue;

    let installmentCurrent = 1;
    let installmentTotal = 1;
    for (const cell of cells) {
      const inst = parseInstallment(cell);
      if (inst) {
        installmentCurrent = inst.current;
        installmentTotal = inst.total;
        break;
      }
    }

    let amountCents: number | null = null;
    for (let i = cells.length - 1; i >= 0; i--) {
      const value = parseCurrencyToCents(cells[i]);
      if (value !== null) {
        amountCents = value;
        break;
      }
    }
    if (amountCents === null) continue;

    lines.push({
      purchaseDate: dateIso,
      description,
      descriptionNorm: descNorm,
      installmentCurrent,
      installmentTotal,
      amountCents,
    });
  }

  return lines;
}

export function parseInvoiceSheet(rows: string[][]): {
  lines: ParsedInvoiceLine[];
  invoiceDueDate: string | null;
  cardLast4: string | null;
} {
  let invoiceDueDate: string | null = null;
  let cardLast4: string | null = null;

  for (const row of rows) {
    const cells = row.map((c) => String(c ?? "").trim()).filter((c) => c.length > 0);
    if (cells.length === 0) continue;
    const joined = cells.join(" ").toLowerCase();
    if (joined.includes("data de vencimento")) {
      for (const cell of cells) {
        const parsed = parseDateBR(cell);
        if (parsed) {
          invoiceDueDate = parsed;
          break;
        }
      }
    }

    if (!cardLast4) {
      for (const cell of cells) {
        const raw = cell.trim();
        if (!raw) continue;
        const cardMatch = raw.match(/\b(?:\d{4}[\s.-]?){3}\d{4}\b/);
        if (cardMatch) {
          const digits = cardMatch[0].replace(/\D/g, "");
          cardLast4 = digits.slice(-4);
          break;
        }
      }
    }

    if (!cardLast4) {
      for (const cell of cells) {
        const digits = cell.replace(/\D/g, "");
        if (digits.length >= 15 && digits.length <= 19) {
          cardLast4 = digits.slice(-4);
          break;
        }
      }
    }
  }

  return { lines: parseInvoiceCsvRobust(rows), invoiceDueDate, cardLast4 };
}

export function buildContractsAndExpenses(
  lines: ParsedInvoiceLine[],
  input: BuildInput
): { contracts: InstallmentContract[]; expenses: ExpenseEntry[] } {
  const provider = input.provider ?? "sicredi";
  const category = input.category ?? "CARTAO_CREDITO";
  const costCenterCode = input.costCenterCode ?? "GERAL";
  const closingDay = input.closingDay ?? 9;
  const dueDay = input.dueDay ?? 15;

  const contractsMap = new Map<string, InstallmentContract>();
  const expenses: ExpenseEntry[] = [];

  for (const line of lines) {
    const purchaseDate = new Date(line.purchaseDate);
    const baseDate =
      provider === "generic"
        ? addMonths(purchaseDate, -(line.installmentCurrent - 1))
        : purchaseDate;

    const firstMonthBase = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
    const firstCompetence =
      purchaseDate.getDate() > closingDay ? addMonths(firstMonthBase, 1) : firstMonthBase;

    const contractHash = cyrb53(
      `${input.cardId}|${line.descriptionNorm}|${toIsoDate(baseDate)}|${line.amountCents}|${line.installmentTotal}`
    );

    if (!contractsMap.has(contractHash)) {
      contractsMap.set(contractHash, {
        id: contractHash,
        provider,
        card_id: input.cardId,
        card_name: input.cardName ?? null,
        purchase_date: toIsoDate(purchaseDate),
        merchant_base: line.descriptionNorm,
        installment_total: line.installmentTotal,
        installment_amount_cents: line.amountCents,
        run_id: input.runId ?? null,
      });
    }

    for (let i = 1; i <= line.installmentTotal; i++) {
      const competenceDate = addMonths(firstCompetence, i - 1);
      const competenceMonth = toMonthRef(competenceDate);
      const invoiceMonth = input.invoiceMonthOverride;
      const status = competenceMonth <= invoiceMonth ? "REAL" : "PREVISTO";

      const expenseId = cyrb53(`${contractHash}|${i}`);
      const descriptionWithInst =
        line.installmentTotal > 1
          ? `${line.description} ${String(i).padStart(2, "0")}/${String(
              line.installmentTotal
            ).padStart(2, "0")}`
          : line.description;

      expenses.push({
        expense_id: expenseId,
        contract_id: contractHash,
        description: descriptionWithInst,
        amount_cents: line.amountCents,
        status,
        date: toIsoDate(purchaseDate),
        operation_date: toIsoDate(purchaseDate),
        competence_month: competenceMonth,
        invoice_month: competenceMonth,
        card_id: input.cardId,
        cost_center_code: costCenterCode,
        category,
        subcategory: input.cardName ?? null,
        type: "DESPESA",
        source: "IMPORT",
        installments_total: line.installmentTotal,
        installment_current: i,
        installment_total: line.installmentTotal,
        parent_entry_id: null,
      });
    }
  }

  return { contracts: Array.from(contractsMap.values()), expenses };
}
