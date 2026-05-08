import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseCSV,
  transformPayerRow,
  transformBillingRow,
  transformCEPRow,
  PayerCSVRow,
  BillingCSVRow,
  CEPCSVRow,
  getHigherPriorityStatus,
  isQuickCancellation,
  isPreviousMonthReissue,
} from "@/lib/csv-import";
import {
  applyPayerProtectedMerge,
  type ExistingPayerLike,
  type PayerMergeDecision,
} from "@/lib/payer-merge";
import { toast } from "sonner";

export interface ImportResult {
  total: number;
  success: number;
  errors: number;
  errorDetails: Array<{ row: number; error: string }>;
  payerUpdatesChanged?: number;
  payerUpdatesUnchanged?: number;
  skippedUnchanged?: number;
}

export type PreResolvedPayerItem = {
  rowNumber: number;
  payer: Record<string, any>;
  isUpdate: boolean;
  decision: PayerMergeDecision;
};

export type PreResolvedPayerImportInput = {
  preResolved: {
    fileName: string;
    totalRows: number;
    resolvedItems: PreResolvedPayerItem[];
    errorDetails: Array<{ row: number; error: string }>;
    protectedAddresses: number;
    protectedPhones: number;
  };
};

const BATCH_SIZE_PAYERS = 200;
const BATCH_SIZE_BILLINGS = 100;
const BATCH_SIZE_CEPS = 500;

const PAYER_UPDATE_FIELDS =
  "id, name, document_digits, payer_code, billing_seen_in_month, last_billing_ref, status, billing_mode, default_route, last_payment_at, needs_review";

function normalizePayerCompareValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (key === "last_payment_at") {
      const dateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      return dateOnly || trimmed;
    }

    return trimmed;
  }

  return value;
}

function hasPayerUpdateChanges(currentPayer: any, update: Record<string, any>): boolean {
  if (!currentPayer) return true;

  return Object.entries(update).some(([key, nextValue]) => {
    const currentValue = currentPayer[key as keyof typeof currentPayer];
    return (
      normalizePayerCompareValue(key, currentValue) !==
      normalizePayerCompareValue(key, nextValue)
    );
  });
}

type TransformedBilling = NonNullable<ReturnType<typeof transformBillingRow>>;

function formatBillingErrorMessage(billing: Partial<TransformedBilling> | undefined, message: string) {
  const payer = billing?.payer_name || billing?.payer_code || billing?.payer_id || "Pagador n?o identificado";
  const referenceMonth = billing?.reference_month || "sem compet?ncia";
  const nossoNumero = billing?.nosso_numero ? ` | Nosso n?mero: ${billing.nosso_numero}` : "";
  return `${payer} | ${referenceMonth}${nossoNumero} | ${message}`;
}

function getBillingIdentityKey(billing: Pick<TransformedBilling, "payer_id" | "reference_month" | "nosso_numero" | "seu_numero" | "due_date" | "status">): string {
  const payer = billing.payer_id || "";
  const ref = billing.reference_month || "";
  const nosso = (billing.nosso_numero || "").trim();
  const seu = (billing.seu_numero || "").trim();
  const due = billing.due_date || "";
  const status = (billing.status || "").trim().toUpperCase() || "UNKNOWN";

  if (nosso) return `${payer}|${ref}|NN|${nosso}|ST|${status}`;
  if (seu || due) return `${payer}|${ref}|SD|${seu}|${due}|ST|${status}`;
  return `${payer}|${ref}|FALLBACK|ST|${status}`;
}

function getBillingBaseLookupKey(billing: Pick<TransformedBilling, "payer_id" | "reference_month" | "nosso_numero" | "seu_numero" | "due_date">): string {
  const payer = billing.payer_id || "";
  const ref = billing.reference_month || "";
  const nosso = (billing.nosso_numero || "").trim();
  const seu = (billing.seu_numero || "").trim();
  const due = billing.due_date || "";

  if (nosso) return `${payer}|${ref}|NN|${nosso}`;
  if (seu || due) return `${payer}|${ref}|SD|${seu}|${due}`;
  return `${payer}|${ref}|FALLBACK`;
}

function getExistingBillingLookupKeys(billing: Pick<TransformedBilling, "payer_id" | "reference_month" | "nosso_numero" | "seu_numero" | "due_date" | "status">): string[] {
  const keys: string[] = [];
  const payer = billing.payer_id || "";
  const ref = billing.reference_month || "";
  const nosso = (billing.nosso_numero || "").trim();
  const seu = (billing.seu_numero || "").trim();
  const due = billing.due_date || "";
  const status = (billing.status || "").trim().toUpperCase() || "UNKNOWN";

  if (nosso) keys.push(`${payer}|${ref}|NN|${nosso}|ST|${status}`);
  if (seu || due) keys.push(`${payer}|${ref}|SD|${seu}|${due}|ST|${status}`);
  keys.push(`${payer}|${ref}|FALLBACK|ST|${status}`);

  return keys;
}

type ExistingBillingLookupRow = {
  id: string;
  payer_id: string;
  status: string;
  reference_month: string;
  due_date: string | null;
  nosso_numero: string | null;
  seu_numero: string | null;
};

async function fetchAllExistingBillingsByColumn(
  column: "payer_id" | "nosso_numero",
  values: string[],
): Promise<ExistingBillingLookupRow[]> {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  const rows: ExistingBillingLookupRow[] = [];
  const chunkSize = 300;
  const pageSize = 1000;

  for (let i = 0; i < uniqueValues.length; i += chunkSize) {
    const chunk = uniqueValues.slice(i, i + chunkSize);
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("billings")
        .select("id, payer_id, status, reference_month, due_date, nosso_numero, seu_numero")
        .in(column, chunk)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      rows.push(...((data || []) as ExistingBillingLookupRow[]));

      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }

  return rows;
}


// Fields fetched from existing payers used for protected-merge logic during reimport
const EXISTING_PAYER_SELECT =
  "id, document_digits, payer_code, name, phone, email, extra_contacts, " +
  "cep, street, number, neighborhood, city, state, address_base, address_original, " +
  "match_ok, review_status, review_reason, review_flag, review_address, needs_review";

type ExistingPayerRecord = ExistingPayerLike;

async function fetchCandidatePayersByIdentity(
  documentDigits: string[],
  payerCodes: string[],
): Promise<ExistingPayerRecord[]> {
  const docChunks: string[][] = [];
  for (let i = 0; i < documentDigits.length; i += 400)
    docChunks.push(documentDigits.slice(i, i + 400));

  const codeChunks: string[][] = [];
  for (let i = 0; i < payerCodes.length; i += 400)
    codeChunks.push(payerCodes.slice(i, i + 400));

  const queries = [
    ...docChunks.map((chunk) =>
      supabase.from("payers").select(EXISTING_PAYER_SELECT).in("document_digits", chunk),
    ),
    ...codeChunks.map((chunk) =>
      supabase.from("payers").select(EXISTING_PAYER_SELECT).in("payer_code", chunk),
    ),
  ];

  const results = await Promise.all(queries);
  const byId = new Map<string, ExistingPayerRecord>();
  for (const { data, error } of results) {
    if (error) throw error;
    (data || []).forEach((p: any) => byId.set(p.id, p as ExistingPayerRecord));
  }

  return Array.from(byId.values());
}

// Generic chunked payer fetch by docs + codes — avoids single large .or() that exceeds URL limits.
// Sends each list as separate .in() queries (200 per chunk) and merges by id.
async function fetchPayersByDocsAndCodes<T extends { id: string }>(
  docs: string[],
  codes: string[],
  selectFields: string,
): Promise<T[]> {
  const CHUNK = 200;
  const docChunks: string[][] = [];
  for (let i = 0; i < docs.length; i += CHUNK) docChunks.push(docs.slice(i, i + CHUNK));
  const codeChunks: string[][] = [];
  for (let i = 0; i < codes.length; i += CHUNK) codeChunks.push(codes.slice(i, i + CHUNK));

  const queries = [
    ...docChunks.map((chunk) =>
      supabase.from("payers").select(selectFields).in("document_digits", chunk),
    ),
    ...codeChunks.map((chunk) =>
      supabase.from("payers").select(selectFields).in("payer_code", chunk),
    ),
  ];

  const results = await Promise.all(queries);
  const byId = new Map<string, T>();
  for (const { data, error } of results) {
    if (error) throw error;
    (data || []).forEach((p: any) => byId.set(p.id, p as T));
  }
  return Array.from(byId.values());
}

// Fetch the subset of CEPs (from the `ceps` base) that match the provided list
async function fetchKnownCEPs(cepDigitsList: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  if (cepDigitsList.length === 0) return known;
  // Deduplicate
  const unique = Array.from(new Set(cepDigitsList.filter((c) => c && c.length === 8)));
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const { data, error } = await supabase.from("ceps").select("cep").in("cep", chunk);
    if (error) throw error;
    (data || []).forEach((r: any) => {
      const d = String(r.cep || "").replace(/\D/g, "");
      if (d) known.add(d);
    });
  }
  return known;
}


export interface PayerImportOptions {
  overwriteAddresses?: boolean;
  overwritePhones?: boolean;
}

async function upsertPayerBatches(
  items: Array<{ rowNumber: number; payer: Record<string, any> }>,
  result: ImportResult & { protectedAddresses?: number; protectedPhones?: number },
  setProgress: (p: number) => void,
): Promise<void> {
  const totalBatches = Math.ceil(items.length / BATCH_SIZE_PAYERS);
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE_PAYERS;
    const batchItems = items.slice(start, start + BATCH_SIZE_PAYERS);
    const batch = batchItems.map((b) => b.payer);
    try {
      const { error } = await supabase
        .from("payers")
        .upsert(batch as any[], { onConflict: "id" });
      if (error) throw error;
      result.success += batchItems.length;
    } catch (err: any) {
      for (const item of batchItems) {
        try {
          const { error: rowError } = await supabase
            .from("payers")
            .upsert(item.payer as any, { onConflict: "id" });
          if (rowError) {
            result.errors++;
            result.errorDetails.push({
              row: item.rowNumber,
              error: [rowError.message, rowError.details].filter(Boolean).join(" | "),
            });
          } else {
            result.success++;
          }
        } catch (e: any) {
          result.errors++;
          result.errorDetails.push({ row: item.rowNumber, error: e.message });
        }
      }
    }
    setProgress(Math.round(((batchIdx + 1) / totalBatches) * 100));
  }
}

async function executePreResolvedImport(
  preResolved: PreResolvedPayerImportInput["preResolved"],
  setProgress: (p: number) => void,
): Promise<ImportResult & { protectedAddresses?: number; protectedPhones?: number }> {
  const runId = crypto.randomUUID();

  const result: ImportResult & { protectedAddresses?: number; protectedPhones?: number } = {
    total: preResolved.totalRows,
    success: 0,
    errors: preResolved.errorDetails.length,
    errorDetails: [...preResolved.errorDetails],
    protectedAddresses: preResolved.protectedAddresses,
    protectedPhones: preResolved.protectedPhones,
  };

  const logPromise = supabase
    .from("import_logs")
    .insert({
      file_name: preResolved.fileName,
      type: "PAYERS",
      total_rows: preResolved.totalRows,
      status: "PROCESSING",
      run_id: runId,
    })
    .select("id")
    .single();

  // Re-stamp run_id on every payload (must be fresh per import run)
  const stamped = preResolved.resolvedItems.map((item) => ({
    ...item,
    payer: { ...item.payer, run_id: runId },
  }));

  // Dedup by payer id (keep last occurrence — same rule as file-based path)
  const dedupMap = new Map<string, typeof stamped[number]>();
  for (const item of stamped) {
    dedupMap.set(item.payer.id, item);
  }
  const deduped = Array.from(dedupMap.values());
  const droppedDuplicates = stamped.length - deduped.length;
  if (droppedDuplicates > 0) {
    result.errorDetails.push({
      row: 0,
      error: `${droppedDuplicates} linha(s) duplicada(s) no CSV (mesmo pagador) foram consolidadas na última ocorrência.`,
    });
  }

  // Only upsert payers that are new or have actual field changes
  const toUpsert = deduped.filter((t) => !t.isUpdate || t.decision.changedFields.length > 0);
  const skippedUnchanged = deduped.length - toUpsert.length;
  result.success += skippedUnchanged;
  result.skippedUnchanged = skippedUnchanged;

  await upsertPayerBatches(toUpsert, result, setProgress);

  const diffSummary = {
    inserted: toUpsert.filter((t) => !t.isUpdate).length,
    updated: toUpsert.filter((t) => t.isUpdate).length,
    skipped: skippedUnchanged + droppedDuplicates,
    errors: result.errors,
  };

  const { data: importLog } = await logPromise;
  if (importLog?.id) {
    await supabase
      .from("import_logs")
      .update({
        status: result.errors === result.total ? "FAILED" : "COMPLETED",
        processed_rows: result.total,
        success_rows: result.success,
        error_rows: result.errors,
        errors: result.errorDetails.slice(0, 100),
        completed_at: new Date().toISOString(),
        diff_summary: diffSummary,
      })
      .eq("id", importLog.id);
  }

  return result;
}

// Optimized payer import with larger batches and parallel processing
export function useOptimizedImportPayers() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (
      input: File | { file: File; options?: PayerImportOptions } | PreResolvedPayerImportInput,
    ): Promise<ImportResult & { protectedAddresses?: number; protectedPhones?: number }> => {
      if ("preResolved" in input) {
        return executePreResolvedImport(input.preResolved, setProgress);
      }

      const file = input instanceof File ? input : input.file;
      const options: PayerImportOptions =
        input instanceof File ? {} : input.options || {};
      const overwriteAddresses = options.overwriteAddresses === true;
      const overwritePhones = options.overwritePhones === true;

      const rows = await parseCSV<PayerCSVRow>(file);
      const runId = crypto.randomUUID();
      const result: ImportResult & { protectedAddresses?: number; protectedPhones?: number } = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
        protectedAddresses: 0,
        protectedPhones: 0,
      };

      // Create import log with run_id
      const logPromise = supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "PAYERS",
          total_rows: rows.length,
          status: "PROCESSING",
          run_id: runId,
        })
        .select("id")
        .single();

      // Transform all rows at once
      const transformed = rows
        .map((row, idx) => ({
          rowNumber: idx + 2,
          payer: transformPayerRow(row),
        }))
        .filter((t): t is { rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>> } => {
          if (!t.payer) {
            result.errors++;
            result.errorDetails.push({ row: t.rowNumber, error: "Dados inválidos" });
            return false;
          }
          return true;
        });

      // Match strategy for reimport: document_digits > payer_code
      const documentDigits = Array.from(
        new Set(transformed.map((v) => v.payer.document_digits).filter((d): d is string => !!d))
      );
      const payerCodes = Array.from(
        new Set(
          transformed
            .filter((v) => !v.payer.document_digits)
            .map((v) => v.payer.payer_code)
            .filter((c): c is string => !!c)
        )
      );

      const candidatePayers =
        documentDigits.length === 0 && payerCodes.length === 0
          ? []
          : await fetchCandidatePayersByIdentity(documentDigits, payerCodes);

      const docMap = new Map<string, string[]>();
      const codeMap = new Map<string, string[]>();
      const existingById = new Map<string, ExistingPayerRecord>();
      (candidatePayers || []).forEach((p) => {
        existingById.set(p.id, p);
        if (p.document_digits) {
          const list = docMap.get(p.document_digits) || [];
          list.push(p.id);
          docMap.set(p.document_digits, list);
        }
        if (p.payer_code) {
          const list = codeMap.get(p.payer_code) || [];
          list.push(p.id);
          codeMap.set(p.payer_code, list);
        }
      });

      // Look up which existing CEPs are validated against the ceps table
      const existingCepDigits = (candidatePayers || [])
        .map((p) => String(p.cep || "").replace(/\D/g, ""))
        .filter((c) => c.length === 8);
      const incomingCepDigits = transformed
        .map((item) => String((item.payer as any).cep || "").replace(/\D/g, ""))
        .filter((c) => c.length === 8);
      const knownCEPs = await fetchKnownCEPs([...existingCepDigits, ...incomingCepDigits]);

      const resolvedTransformedRaw = transformed
        .map((item) => {
          const doc = item.payer.document_digits || null;
          const code = item.payer.payer_code || null;
          const docMatches = doc ? (docMap.get(doc) || []) : [];
          const codeMatches = !doc && code ? (codeMap.get(code) || []) : [];

          if (docMatches.length > 1) {
            result.errors++;
            result.errorDetails.push({ row: item.rowNumber, error: `Ambiguidade por CPF (${doc})` });
            return null;
          }
          if (!doc && codeMatches.length > 1) {
            result.errors++;
            result.errorDetails.push({ row: item.rowNumber, error: `Ambiguidade por Cod Pagador (${code})` });
            return null;
          }

          const docId = docMatches[0] || null;
          const codeId = !doc ? (codeMatches[0] || null) : null;
          const targetId = docId || codeId || item.payer.id;
          const isUpdate = !!(docId || codeId);
          const existing = isUpdate ? existingById.get(targetId) : undefined;

          // Apply protected merge rules (shared with dry-run in Import.tsx)
          const { payload: merged, decision } = applyPayerProtectedMerge(
            { ...item.payer, id: targetId },
            existing ?? null,
            knownCEPs,
            { overwriteAddresses, overwritePhones },
            runId,
          );

          if (existing) {
            if (decision.addressProtected) result.protectedAddresses = (result.protectedAddresses || 0) + 1;
            if (decision.phoneProtected) result.protectedPhones = (result.protectedPhones || 0) + 1;
          }

          return {
            ...item,
            payer: merged as NonNullable<ReturnType<typeof transformPayerRow>>,
            isUpdate,
            decision,
          };
        })
        .filter(Boolean) as Array<{ rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>>; isUpdate: boolean; decision: ReturnType<typeof applyPayerProtectedMerge>["decision"] }>;


      // Avoid Postgres ON CONFLICT cardinality errors when the same id appears multiple times in one CSV.
      // Keep the last occurrence for each payer id.
      const dedupMap = new Map<string, typeof resolvedTransformedRaw[number]>();
      for (const item of resolvedTransformedRaw) {
        dedupMap.set(item.payer.id, item);
      }
      const resolvedTransformed = Array.from(dedupMap.values());
      const droppedDuplicates = resolvedTransformedRaw.length - resolvedTransformed.length;
      if (droppedDuplicates > 0) {
        result.errorDetails.push({
          row: 0,
          error: `${droppedDuplicates} linha(s) duplicada(s) no CSV (mesmo pagador) foram consolidadas na última ocorrência.`,
        });
      }

      // Only upsert payers that are new or have actual field changes.
      // Existing payers with no changed fields are skipped to avoid unnecessary writes.
      const toUpsert = resolvedTransformed.filter(
        (t) => !t.isUpdate || t.decision.changedFields.length > 0,
      );
      const skippedUnchanged = resolvedTransformed.length - toUpsert.length;
      result.success += skippedUnchanged;

      await upsertPayerBatches(toUpsert, result, setProgress);

      result.skippedUnchanged = skippedUnchanged;

      // Build diff summary
      const diffSummary = {
        inserted: toUpsert.filter((t) => !t.isUpdate).length,
        updated: toUpsert.filter((t) => t.isUpdate).length,
        skipped: skippedUnchanged + droppedDuplicates,
        errors: result.errors,
      };

      // Update import log
      const { data: importLog } = await logPromise;
      if (importLog?.id) {
        await supabase
          .from("import_logs")
          .update({
            status: result.errors === result.total ? "FAILED" : "COMPLETED",
            processed_rows: result.total,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails.slice(0, 100),
            completed_at: new Date().toISOString(),
            diff_summary: diffSummary,
          })
          .eq("id", importLog.id);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });

      const protBits: string[] = [];
      if (result.protectedAddresses) protBits.push(`${result.protectedAddresses} endereço(s) preservado(s)`);
      if (result.protectedPhones) protBits.push(`${result.protectedPhones} telefone(s) preservado(s)`);
      const protMsg = protBits.length > 0 ? ` — ${protBits.join(", ")}` : "";

      const written = result.success - (result.skippedUnchanged ?? 0);
      const skippedMsg = result.skippedUnchanged ? `, ${result.skippedUnchanged} sem alteração` : "";

      if (result.errors > 0) {
        toast.warning(`Importação: ${written} gravados${skippedMsg}, ${result.errors} erros${protMsg}`);
      } else {
        toast.success(`${written} pagadores gravados${skippedMsg}${protMsg}`);
      }
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    importPayers: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    reset: useCallback(() => setProgress(0), []),
  };
}

// Optimized billing import with caching and batch operations
export function useOptimizedImportBillings() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (input: File | { file: File; nameUpdates?: Record<string, string> }): Promise<ImportResult & { referenceMonth: string | null }> => {
      const file = input instanceof File ? input : input.file;
      const nameUpdates = input instanceof File ? undefined : input.nameUpdates;
      const rows = await parseCSV<BillingCSVRow>(file);
      const runId = crypto.randomUUID();
      const result: ImportResult & { referenceMonth: string | null } = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
        referenceMonth: null,
      };

      // Create import log with run_id
      const logPromise = supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "BILLINGS",
          total_rows: rows.length,
          status: "PROCESSING",
          run_id: runId,
        })
        .select("id")
        .single();

      // Keep history of all emitted billings; dedupe only exact same billing identity inside the file
      const billingMap = new Map<string, TransformedBilling>();
      const payerIdsInImport = new Set<string>();
      const payerMonthStatus = new Map<string, "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW">();
      const importedPayerIds = new Set<string>();

      for (const row of rows) {
        const billing = transformBillingRow(row);
        if (!billing) continue;

        const key = getBillingIdentityKey(billing);
        const existing = billingMap.get(key);

        if (existing) {
          const higherStatus = getHigherPriorityStatus(
            billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW",
            existing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW"
          );
          if (higherStatus === billing.status) {
            billingMap.set(key, billing);
          }
        } else {
          billingMap.set(key, billing);
        }

        payerIdsInImport.add(billing.payer_id);

        if (!result.referenceMonth && billing.reference_month) {
          result.referenceMonth = billing.reference_month;
        }
      }

      const billings = Array.from(billingMap.values());
      // Sort ascending so the most recent month's billing always overwrites payer state last
      billings.sort((a, b) => (a.reference_month || "").localeCompare(b.reference_month || ""));
      const maxReferenceMonth = billings.reduce(
        (max, b) => (!max || (b.reference_month || "") > max ? b.reference_month || "" : max),
        ""
      ) || null;

      // Pre-fetch existing payers in one query using import identifiers (CPF/Cod Pagador)
      const importedDocs = Array.from(
        new Set(
          Array.from(payerIdsInImport).filter((v) => /^\d{11}$/.test(v))
        )
      );
      const importedCodes = Array.from(
        new Set(
          billings
            .map((b) => b.payer_code || b.payer_id)
            .filter((v) => !/^\d{11}$/.test(v || ""))
            .filter((v): v is string => !!v)
        )
      );
      const importedNossoNumeros = Array.from(
        new Set(
          billings
            .map((b) => b.nosso_numero?.trim())
            .filter((v): v is string => !!v)
        )
      );

      const existingPayers = (importedDocs.length > 0 || importedCodes.length > 0)
        ? await fetchPayersByDocsAndCodes(importedDocs, importedCodes, PAYER_UPDATE_FIELDS)
        : [];

      const existingPayerIds = new Set(existingPayers?.map((p) => p.id) || []);
      const existingPayerCodes = new Map(
        existingPayers?.filter((p) => p.payer_code).map((p) => [p.payer_code!, p.id]) || []
      );
      const existingPayerByDocument = new Map(
        existingPayers?.filter((p) => (p as any).document_digits).map((p: any) => [p.document_digits as string, p.id as string]) || []
      );
      const payerStateById = new Map(
        (existingPayers || []).map((p) => [p.id, p])
      );

      const payerIds = Array.from(existingPayerIds);

      const existingBillingsById = new Map(
        (payerIds.length > 0
          ? await fetchAllExistingBillingsByColumn("payer_id", payerIds)
          : []
        ).map((billing) => [billing.id, billing])
      );

      if (importedNossoNumeros.length > 0) {
        const billingsByNosso = await fetchAllExistingBillingsByColumn("nosso_numero", importedNossoNumeros);
        billingsByNosso.forEach((billing) => existingBillingsById.set(billing.id, billing));
      }

      const existingBillings = Array.from(existingBillingsById.values());

      const existingBillingsMap = new Map<string, (typeof existingBillings)[number]>();
      const existingBillingsByBase = new Map<string, (typeof existingBillings)[number][]>();
      // Índice global por nosso_numero (sem payer_id nem reference_month)
      // nosso_numero é único no banco emissor → permite encontrar mesmo quando o mês mudou
      const existingBillingsByNosso = new Map<string, (typeof existingBillings)[number][]>();

      const registerExistingBilling = (billingRow: (typeof existingBillings)[number]) => {
        const keys = getExistingBillingLookupKeys({
          payer_id: billingRow.payer_id,
          reference_month: billingRow.reference_month,
          nosso_numero: billingRow.nosso_numero,
          seu_numero: billingRow.seu_numero,
          due_date: billingRow.due_date,
          status: billingRow.status as any,
        });
        keys.forEach((k) => existingBillingsMap.set(k, billingRow));

        // Indexar sob todas as variações de base key para sobreviver a mismatches de nosso_numero
        // Ex: DB tem nosso_numero mas CSV novo não tem (ou vice-versa)
        const baseKeysToRegister = [
          getBillingBaseLookupKey({
            payer_id: billingRow.payer_id,
            reference_month: billingRow.reference_month,
            nosso_numero: billingRow.nosso_numero,
            seu_numero: billingRow.seu_numero,
            due_date: billingRow.due_date,
          }),
        ];
        if (billingRow.nosso_numero) {
          // Também indexar sem nosso_numero: permite que CSV sem nosso_numero encontre este registro
          baseKeysToRegister.push(
            getBillingBaseLookupKey({
              payer_id: billingRow.payer_id,
              reference_month: billingRow.reference_month,
              nosso_numero: null,
              seu_numero: billingRow.seu_numero,
              due_date: billingRow.due_date,
            })
          );
        }
        for (const baseKey of baseKeysToRegister) {
          const list = existingBillingsByBase.get(baseKey) || [];
          const next = list.filter((x) => x.id !== billingRow.id);
          next.push(billingRow);
          existingBillingsByBase.set(baseKey, next);
        }
        // Índice global por nosso_numero (sem payer_id/reference_month)
        if (billingRow.nosso_numero) {
          const nn = billingRow.nosso_numero.trim();
          const nnList = existingBillingsByNosso.get(nn) || [];
          const nnNext = nnList.filter((x) => x.id !== billingRow.id);
          nnNext.push(billingRow);
          existingBillingsByNosso.set(nn, nnNext);
        }
      };

      existingBillings.forEach((b) => registerExistingBilling(b));

      // Process billings in batches
      const newBillings: any[] = [];
      const updateBillings: { id: string; data: any }[] = [];
      const payersToCreate: any[] = [];
      const payerUpdates: Map<string, any> = new Map();

      for (let i = 0; i < billings.length; i++) {
        const billing = billings[i];
        if (!billing) continue;

        const looksLikeCpf = /^\d{11}$/.test(billing.payer_id || "");
        const docCandidate = looksLikeCpf ? billing.payer_id : null;
        const codeCandidate = billing.payer_code || (!looksLikeCpf ? billing.payer_id : null);

        let payerId =
          (docCandidate ? existingPayerByDocument.get(docCandidate) : null) ||
          (codeCandidate ? existingPayerCodes.get(codeCandidate) : null) ||
          null;

        const payerRoute =
          billing.amount_expected_cents > 50000 ? "FRANCA" : "BARRETOS";

        // Create placeholder payer when no match by document/code
        if (!payerId) {
          payerId = crypto.randomUUID();
          payersToCreate.push({
            id: payerId,
            name: billing.payer_name || `Pagador ${codeCandidate || billing.payer_id}`,
            document: docCandidate,
            document_digits: docCandidate,
            payer_code: codeCandidate,
            status: "ATIVO",
            billing_mode: "BOLETO",
            review_flag: true,
            needs_review: true,
            review_status: "REVIEW",
            review_reason: "IMPORT_BILLING_SEM_CADASTRO",
            default_route: payerRoute,
            birth_date: null,
          });
          payerStateById.set(payerId, {
            id: payerId,
            payer_code: codeCandidate,
            document_digits: docCandidate || "",
            name: billing.payer_name || `Pagador ${codeCandidate || billing.payer_id}`,
            billing_seen_in_month: null,
            last_billing_ref: null,
            status: "ATIVO",
            billing_mode: "BOLETO",
            default_route: payerRoute,
            last_payment_at: null,
            needs_review: true,
          });
          existingPayerIds.add(payerId);
          if (docCandidate) existingPayerByDocument.set(docCandidate, payerId);
          if (codeCandidate) existingPayerCodes.set(codeCandidate, payerId);
        }

        const existingStatus = payerMonthStatus.get(payerId);
        const nextStatus = existingStatus
          ? getHigherPriorityStatus(
              billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW",
              existingStatus
            )
          : (billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW");
        payerMonthStatus.set(payerId, nextStatus);

        payerIdsInImport.add(payerId);
        importedPayerIds.add(payerId);

        const baseKey = getBillingBaseLookupKey({
          payer_id: payerId,
          reference_month: billing.reference_month,
          nosso_numero: billing.nosso_numero,
          seu_numero: billing.seu_numero,
          due_date: billing.due_date,
        });

        const baseKeys = [baseKey];
        if (billing.nosso_numero) {
          baseKeys.push(
            getBillingBaseLookupKey({
              payer_id: payerId,
              reference_month: billing.reference_month,
              nosso_numero: null,
              seu_numero: billing.seu_numero,
              due_date: billing.due_date,
            })
          );
        }

        let existingVariants = Array.from(
          new Map(
            baseKeys
              .flatMap((k) => existingBillingsByBase.get(k) || [])
              .map((b) => [b.id, b])
          ).values()
        );

        // Fallback: se não achou por payer+ref+nosso, busca globalmente pelo nosso_numero
        // Cobre o caso em que o vencimento mudou e o reference_month ficou diferente do DB
        let foundViaNossoFallback = false;
        if (existingVariants.length === 0 && billing.nosso_numero) {
          const nn = billing.nosso_numero.trim();
          const byNosso = existingBillingsByNosso.get(nn) || [];
          const samePayerNosso = byNosso.filter((b) => b.payer_id === payerId);
          const nossoMatches = samePayerNosso.length > 0 ? samePayerNosso : byNosso;
          if (nossoMatches.length > 0) {
            existingVariants = nossoMatches;
            foundViaNossoFallback = true;
          }
        }

        const billingData = {
          payer_id: payerId,
          payer_code: billing.payer_code,
          nosso_numero: billing.nosso_numero,
          seu_numero: billing.seu_numero,
          issued_at: billing.issued_at,
          due_date: billing.due_date,
          liquidation_at: billing.liquidation_at,
          settlement_at: billing.settlement_at,
          amount_expected_cents: billing.amount_expected_cents,
          amount_paid_cents: billing.amount_paid_cents,
          status: billing.status,
          reference_month: billing.reference_month,
          payment_method: billing.payment_method,
          source: billing.source,
          route: billing.route,
          source_file_name: file.name,
          run_id: runId,
        };

        const registerPlannedUpdate = (targetId: string, status: string) => {
          const updatedPayload = { ...billingData, status };
          // Prefer upsert by nosso_numero (reliable) over update by internal ID (can silently no-op)
          if (billingData.nosso_numero) {
            newBillings.push(updatedPayload);
          } else {
            updateBillings.push({ id: targetId, data: updatedPayload });
          }

          registerExistingBilling({
            id: targetId,
            payer_id: billingData.payer_id,
            status,
            reference_month: billingData.reference_month,
            due_date: billingData.due_date,
            nosso_numero: billingData.nosso_numero,
            seu_numero: billingData.seu_numero,
          } as any);
        };

        const registerPlannedInsert = (status: string) => {
          newBillings.push({ ...billingData, status });
          registerExistingBilling({
            id: `__pending_insert__${newBillings.length}`,
            payer_id: billingData.payer_id,
            status,
            reference_month: billingData.reference_month,
            due_date: billingData.due_date,
            nosso_numero: billingData.nosso_numero,
            seu_numero: billingData.seu_numero,
          } as any);
        };

        const sameStatus = existingVariants.find((b) => b.status === billing.status);
        const hasPaidVariant = existingVariants.some((b) => b.status === "PAID");
        const openVariant = existingVariants.find((b) => b.status === "OPEN");
        const cancelVariant = existingVariants.find((b) => b.status === "CANCELADO");

        // Quando encontrado via nosso_numero global (mês diferente) e não há outro registro base:
        // atualizar o OPEN para PAID diretamente
        if (foundViaNossoFallback && billing.status === "PAID" && openVariant) {
          registerPlannedUpdate(openVariant.id, "PAID");
          continue;
        }

        if (sameStatus) {
          const dueDateChanged = (sameStatus.due_date || null) !== (billingData.due_date || null);
          const nossoChanged = (sameStatus.nosso_numero || null) !== (billingData.nosso_numero || null);
          const seuChanged = (sameStatus.seu_numero || null) !== (billingData.seu_numero || null);
          const refMonthChanged = (sameStatus.reference_month || null) !== (billingData.reference_month || null);
          if (dueDateChanged || nossoChanged || seuChanged || refMonthChanged) {
            registerPlannedUpdate(sameStatus.id, billing.status);
          }
        } else if (billing.status === "CANCELADO" && openVariant && !hasPaidVariant) {
          registerPlannedUpdate(openVariant.id, "CANCELADO");
        } else if ((billing.status === "PAID" || billing.status === "OPEN") && !hasPaidVariant) {
          const transitionTarget = openVariant || cancelVariant;
          if (transitionTarget) {
            registerPlannedUpdate(transitionTarget.id, billing.status);
          } else {
            registerPlannedInsert(billing.status);
          }
        } else if (billing.status === "OPEN" && hasPaidVariant && !isPreviousMonthReissue(billing.seu_numero)) {
          // Ignore OPEN if already paid in the same billing base.
          // ANT/ANTERIOR boletos are reissues of a prior debt and must always be processed.
        } else {
          registerPlannedInsert(billing.status);
        }

        // Limpar registros OPEN órfãos de outros meses com o mesmo nosso_numero.
        // Ocorre quando o vencimento mudou e criou um reference_month diferente no DB.
        if (billing.nosso_numero && billing.status === "PAID") {
          const nn = billing.nosso_numero.trim();
          const byNosso = existingBillingsByNosso.get(nn) || [];
          const existingVariantIds = new Set(existingVariants.map((v) => v.id));
          const orphanOpens = byNosso.filter(
            (b) => !existingVariantIds.has(b.id) && b.status === "OPEN" && b.payer_id === payerId
          );
          for (const orphanOpen of orphanOpens) {
            registerPlannedUpdate(orphanOpen.id, "PAID");
          }
        }

        // Accumulate payer updates
        const needsReview =
          billing.status === "NEEDS_REVIEW" ||
          isQuickCancellation(billing.due_date, billing.liquidation_at);

        const payerUpdate: any = {
          billing_seen_in_month: billing.reference_month,
          ...(billing.payer_code ? { payer_code: billing.payer_code } : {}),
          last_billing_ref: billing.reference_month,
          billing_mode: "BOLETO",
          default_route: payerRoute,
          ...(billing.reference_month === maxReferenceMonth ? { status: "ATIVO" } : {}),
        };

        if (billing.status === "PAID") {
          payerUpdate.last_payment_at = billing.settlement_at || billing.due_date || null;
        }

        if (needsReview) {
          payerUpdate.needs_review = true;
        }

        const currentPayerState = payerStateById.get(payerId);
        if (hasPayerUpdateChanges(currentPayerState, payerUpdate)) {
          payerUpdates.set(payerId, payerUpdate);
          payerStateById.set(payerId, {
            ...(currentPayerState || { id: payerId }),
            ...payerUpdate,
          });
        }
      }

      setProgress(30);

      // Create placeholder payers in batch
      if (payersToCreate.length > 0) {
        const { error } = await supabase
          .from("payers")
          .upsert(
            payersToCreate.map((payer) => ({
              ...payer,
            })),
            { onConflict: "id" }
          );

        if (error) {
          result.errors += payersToCreate.length;
          result.errorDetails.push({
            row: 0,
            error: `Falha ao criar pagadores tempor?rios da importa??o: ${error.message}`,
          });
          throw error;
        }
      }

      setProgress(40);

      // Insert new billings in batches.
      // Usa upsert com onConflict nosso_numero para garantir que boletos com
      // o mesmo nosso_numero nunca sejam duplicados — a constraint única no banco
      // é a fonte de verdade, e o upsert respeita isso atualizando em vez de duplicar.
      for (let i = 0; i < newBillings.length; i += BATCH_SIZE_BILLINGS) {
        const batch = newBillings.slice(i, i + BATCH_SIZE_BILLINGS);
        // Separar boletos com e sem nosso_numero: só os que têm podem usar onConflict
        const withNosso = batch.filter((b) => b.nosso_numero);
        const withoutNosso = batch.filter((b) => !b.nosso_numero);
        try {
          if (withNosso.length > 0) {
            const { error } = await supabase
              .from("billings")
              .upsert(withNosso, { onConflict: "nosso_numero" });
            if (error) throw error;
            result.success += withNosso.length;
          }
          if (withoutNosso.length > 0) {
            const { error } = await supabase.from("billings").insert(withoutNosso);
            if (error) throw error;
            result.success += withoutNosso.length;
          }
        } catch (err: any) {
          // Fallback to individual upserts/inserts
          for (const b of batch) {
            try {
              const { error } = b.nosso_numero
                ? await supabase.from("billings").upsert(b, { onConflict: "nosso_numero" })
                : await supabase.from("billings").insert(b);
              if (error) {
                result.errors++;
                result.errorDetails.push({ row: 0, error: formatBillingErrorMessage(b, error.message) });
              } else {
                result.success++;
              }
            } catch (e: any) {
              result.errors++;
              result.errorDetails.push({ row: 0, error: formatBillingErrorMessage(b, e.message) });
            }
          }
        }
        setProgress(40 + Math.round((i / newBillings.length) * 30));
      }

      setProgress(70);

      // Update existing billings in parallel chunks
      const UPDATE_BILLINGS_CHUNK = 50;
      for (let i = 0; i < updateBillings.length; i += UPDATE_BILLINGS_CHUNK) {
        const chunk = updateBillings.slice(i, i + UPDATE_BILLINGS_CHUNK);
        await Promise.all(
          chunk.map(async ({ id, data }) => {
            try {
              await supabase.from("billings").update(data).eq("id", id);
              result.success++;
            } catch (err: any) {
              result.errors++;
              result.errorDetails.push({ row: 0, error: formatBillingErrorMessage(data as Partial<TransformedBilling>, err.message) });
            }
          })
        );
      }

      setProgress(85);

      // Update payers in batch via upsert (1 query per batch instead of N parallel updates)
      const payerUpdateEntries = Array.from(payerUpdates.entries());
      for (let i = 0; i < payerUpdateEntries.length; i += BATCH_SIZE_PAYERS) {
        const batch = payerUpdateEntries.slice(i, i + BATCH_SIZE_PAYERS);
        await supabase
          .from("payers")
          .upsert(
            batch.map(([id, update]) => ({ id, ...update })),
            { onConflict: "id" }
          );
      }

      // Apply approved name updates from user
      if (nameUpdates && Object.keys(nameUpdates).length > 0) {
        const nameEntries = Object.entries(nameUpdates).map(([id, name]) => ({ id, name }));
        for (let i = 0; i < nameEntries.length; i += BATCH_SIZE_PAYERS) {
          await supabase
            .from("payers")
            .upsert(nameEntries.slice(i, i + BATCH_SIZE_PAYERS), { onConflict: "id" });
        }
      }

      setProgress(95);

      result.payerUpdatesChanged = payerUpdates.size;
      result.payerUpdatesUnchanged = Math.max(0, importedPayerIds.size - payerUpdates.size);

      // Deactivate payers not in import
      if (result.referenceMonth) {
        await applyPayerMonthStatus(result.referenceMonth, payerMonthStatus);
        await deactivatePayersNotInImport(result.referenceMonth, payerIdsInImport);
      }

      // Build diff summary
      const diffSummary = {
        new_billings: newBillings.length,
        updated_billings: updateBillings.length,
        new_payers: payersToCreate.length,
        payer_updates: payerUpdates.size,
        errors: result.errors,
      };

      // Update import log
      const { data: importLog } = await logPromise;
      if (importLog?.id) {
        await supabase
          .from("import_logs")
          .update({
            status: result.errors === result.total ? "FAILED" : "COMPLETED",
            processed_rows: billings.length,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails.slice(0, 100),
            completed_at: new Date().toISOString(),
            diff_summary: diffSummary,
          })
          .eq("id", importLog.id);
      }

      setProgress(100);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["billings"] });
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });

      const payerSummary =
        typeof result.payerUpdatesChanged === "number" && typeof result.payerUpdatesUnchanged === "number"
          ? ` Pagadores alterados: ${result.payerUpdatesChanged}. Sem mudança: ${result.payerUpdatesUnchanged}.`
          : "";

      if (result.errors > 0) {
        toast.warning(`Importação: ${result.success} OK, ${result.errors} erros.${payerSummary}`);
      } else {
        toast.success(`${result.success} boletos importados!${payerSummary}`);
      }
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    importBillings: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    reset: useCallback(() => setProgress(0), []),
  };
}

// Optimized CEP import with very large batches
export function useOptimizedImportCEPs() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const rows = await parseCSV<CEPCSVRow>(file);
      const runId = crypto.randomUUID();
      const result: ImportResult = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
      };

      const logPromise = supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "CEPS",
          total_rows: rows.length,
          status: "PROCESSING",
          run_id: runId,
        })
        .select("id")
        .single();

      const ceps = rows.map(transformCEPRow).filter(Boolean) as NonNullable<
        ReturnType<typeof transformCEPRow>
      >[];

      const totalBatches = Math.ceil(ceps.length / BATCH_SIZE_CEPS);

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const start = batchIdx * BATCH_SIZE_CEPS;
        const batch = ceps.slice(start, start + BATCH_SIZE_CEPS);

        try {
          const { error } = await supabase
            .from("ceps")
            .upsert(batch, { onConflict: "cep" });

          if (error) throw error;
          result.success += batch.length;
        } catch (err: any) {
          result.errors += batch.length;
          result.errorDetails.push({ row: start, error: err.message });
        }

        setProgress(Math.round(((batchIdx + 1) / totalBatches) * 100));
      }

      const { data: importLog } = await logPromise;
      if (importLog?.id) {
        await supabase
          .from("import_logs")
          .update({
            status: result.errors === result.total ? "FAILED" : "COMPLETED",
            processed_rows: ceps.length,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails.slice(0, 100),
            completed_at: new Date().toISOString(),
          })
          .eq("id", importLog.id);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ceps"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });

      if (result.errors > 0) {
        toast.warning(`Importação: ${result.success} OK, ${result.errors} erros`);
      } else {
        toast.success(`${result.success} CEPs importados!`);
      }
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    importCEPs: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    reset: useCallback(() => setProgress(0), []),
  };
}

async function applyPayerMonthStatus(
  referenceMonth: string,
  payerMonthStatus: Map<string, "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW">
) {
  const toDeactivate: string[] = [];
  const toActivate: string[] = [];

  for (const [payerId, status] of payerMonthStatus.entries()) {
    if (status === "CANCELADO") {
      toDeactivate.push(payerId);
    } else if (status === "PAID" || status === "OPEN") {
      toActivate.push(payerId);
    }
  }

  if (toDeactivate.length > 0) {
    for (let i = 0; i < toDeactivate.length; i += 500) {
      const batch = toDeactivate.slice(i, i + 500);
      await supabase
        .from("payers")
        .update({ status: "INATIVO" })
        .eq("status", "ATIVO")
        .in("id", batch);
    }
  }

  if (toActivate.length > 0) {
    for (let i = 0; i < toActivate.length; i += 500) {
      const batch = toActivate.slice(i, i + 500);
      await supabase
        .from("payers")
        .update({ status: "ATIVO" })
        .neq("status", "ATIVO")
        .in("id", batch);
    }
  }
}

// Helper function to deactivate payers not in import
async function deactivatePayersNotInImport(
  referenceMonth: string,
  payerIdsInImport: Set<string>
) {
  const PAGE_SIZE = 1000;
  const payersToDeactivate: string[] = [];
  const mixedToReview: string[] = [];

  // Paginate to avoid Supabase's default 1000-row truncation
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("payers")
      .select("id, billing_mode, is_coordinator, manual_active_until, needs_review")
      .eq("status", "ATIVO")
      .range(from, from + PAGE_SIZE - 1);

    if (error) break;
    if (!page || page.length === 0) break;

    for (const payer of page) {
      if (payerIdsInImport.has(payer.id)) continue;
      if (payer.is_coordinator) continue;
      if (payer.manual_active_until && payer.manual_active_until >= referenceMonth) continue;
      if (payer.billing_mode === "PIX_ONLY") continue;
      if (payer.billing_mode === "MIXED") {
        if (!payer.needs_review) mixedToReview.push(payer.id);
        continue;
      }
      payersToDeactivate.push(payer.id);
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (payersToDeactivate.length > 0) {
    for (let i = 0; i < payersToDeactivate.length; i += 500) {
      const batch = payersToDeactivate.slice(i, i + 500);
      await supabase
        .from("payers")
        .update({ status: "INATIVO" })
        .eq("status", "ATIVO")
        .in("id", batch);
    }
  }

  if (mixedToReview.length > 0) {
    for (let i = 0; i < mixedToReview.length; i += 500) {
      const batch = mixedToReview.slice(i, i + 500);
      await supabase.from("payers").update({ needs_review: true }).in("id", batch);
    }
  }
}
