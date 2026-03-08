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
} from "@/lib/csv-import";
import { toast } from "sonner";

export interface ImportResult {
  total: number;
  success: number;
  errors: number;
  errorDetails: Array<{ row: number; error: string }>;
  payerUpdatesChanged?: number;
  payerUpdatesUnchanged?: number;
}

const BATCH_SIZE_PAYERS = 200;
const BATCH_SIZE_BILLINGS = 100;
const BATCH_SIZE_CEPS = 500;

const PAYER_UPDATE_FIELDS =
  "id, payer_code, billing_seen_in_month, last_billing_ref, status, billing_mode, default_route, last_payment_at, needs_review";

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


async function fetchCandidatePayersByIdentity(documentDigits: string[], payerCodes: string[]) {
  const byId = new Map<string, { id: string; document_digits: string | null; payer_code: string | null }>();

  for (let i = 0; i < documentDigits.length; i += 400) {
    const chunk = documentDigits.slice(i, i + 400);
    const { data, error } = await supabase
      .from("payers")
      .select("id, document_digits, payer_code")
      .in("document_digits", chunk);

    if (error) throw error;
    (data || []).forEach((p: any) => byId.set(p.id, p));
  }

  for (let i = 0; i < payerCodes.length; i += 400) {
    const chunk = payerCodes.slice(i, i + 400);
    const { data, error } = await supabase
      .from("payers")
      .select("id, document_digits, payer_code")
      .in("payer_code", chunk);

    if (error) throw error;
    (data || []).forEach((p: any) => byId.set(p.id, p));
  }

  return Array.from(byId.values());
}

// Optimized payer import with larger batches and parallel processing
export function useOptimizedImportPayers() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const rows = await parseCSV<PayerCSVRow>(file);
      const runId = crypto.randomUUID();
      const result: ImportResult = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
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
        new Set(transformed.map((v) => v.payer.payer_code).filter((c): c is string => !!c))
      );

      const candidatePayers =
        documentDigits.length === 0 && payerCodes.length === 0
          ? []
          : await fetchCandidatePayersByIdentity(documentDigits, payerCodes);

      const docMap = new Map<string, string[]>();
      const codeMap = new Map<string, string[]>();
      (candidatePayers || []).forEach((p: any) => {
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

      const resolvedTransformedRaw = transformed
        .map((item) => {
          const doc = item.payer.document_digits || null;
          const code = item.payer.payer_code || null;
          const docMatches = doc ? (docMap.get(doc) || []) : [];
          const codeMatches = code ? (codeMap.get(code) || []) : [];

          if (docMatches.length > 1) {
            result.errors++;
            result.errorDetails.push({ row: item.rowNumber, error: `Ambiguidade por CPF (${doc})` });
            return null;
          }
          if (codeMatches.length > 1) {
            result.errors++;
            result.errorDetails.push({ row: item.rowNumber, error: `Ambiguidade por Cod Pagador (${code})` });
            return null;
          }

          const docId = docMatches[0] || null;
          const codeId = codeMatches[0] || null;
          if (docId && codeId && docId !== codeId) {
            result.errors++;
            result.errorDetails.push({
              row: item.rowNumber,
              error: `Conflito de identidade: CPF aponta para ${docId} e Cod Pagador para ${codeId}`,
            });
            return null;
          }

          const targetId = docId || codeId || item.payer.id;
          return { ...item, payer: { ...item.payer, id: targetId } };
        })
        .filter(Boolean) as Array<{ rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>> }>;

      // Avoid Postgres ON CONFLICT cardinality errors when the same id appears multiple times in one CSV.
      // Keep the last occurrence for each payer id.
      const dedupMap = new Map<string, { rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>> }>();
      for (const item of resolvedTransformedRaw) {
        dedupMap.set(item.payer.id, item);
      }
      const resolvedTransformed = Array.from(dedupMap.values());
      const droppedDuplicates = resolvedTransformedRaw.length - resolvedTransformed.length;
      if (droppedDuplicates > 0) {
        result.errorDetails.push({
          row: 0,
          error: `${droppedDuplicates} linha(s) duplicada(s) no CSV (mesmo pagador) foram consolidadas na ?ltima ocorr?ncia.`,
        });
      }

      // Process in larger batches
      const totalBatches = Math.ceil(resolvedTransformed.length / BATCH_SIZE_PAYERS);

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {

        const start = batchIdx * BATCH_SIZE_PAYERS;
        const batchItems = resolvedTransformed.slice(start, start + BATCH_SIZE_PAYERS);
        const batch = batchItems.map((b) => b.payer);

        try {
          const { error } = await supabase
            .from("payers")
            .upsert(batch as any[], { onConflict: "id" });

          if (error) throw error;
          result.success += batchItems.length;
        } catch (err: any) {
          // Only fallback to per-row if batch fails
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
            errors: result.errorDetails.slice(0, 100), // Limit error details
            completed_at: new Date().toISOString(),
          })
          .eq("id", importLog.id);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payers"] });

      if (result.errors > 0) {
        toast.warning(`Importa??o: ${result.success} OK, ${result.errors} erros`);
      } else {
        toast.success(`${result.success} pagadores importados!`);
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
    mutationFn: async (file: File): Promise<ImportResult & { referenceMonth: string | null }> => {
      const rows = await parseCSV<BillingCSVRow>(file);
      const result: ImportResult & { referenceMonth: string | null } = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
        referenceMonth: null,
      };

      // Create import log
      const logPromise = supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "BILLINGS",
          total_rows: rows.length,
          status: "PROCESSING",
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

      // Pre-fetch existing payers in one query using import identifiers (CPF/Cod Pagador)
      const importedDocs = Array.from(
        new Set(
          Array.from(payerIdsInImport).filter((v) => /^\d{11}$/.test(v))
        )
      );
      const importedCodes = Array.from(
        new Set(
          billings
            .map((b) => b.payer_code || (/^\d{11}$/.test(b.payer_id) ? null : b.payer_id))
            .filter((v): v is string => !!v)
        )
      );

      let existingPayersQuery = supabase.from("payers").select(PAYER_UPDATE_FIELDS);
      if (importedDocs.length > 0 && importedCodes.length > 0) {
        existingPayersQuery = existingPayersQuery.or(
          `document_digits.in.(${importedDocs.map((d) => `"${d}"`).join(",")}),payer_code.in.(${importedCodes.map((c) => `"${c}"`).join(",")})`
        );
      } else if (importedDocs.length > 0) {
        existingPayersQuery = existingPayersQuery.in("document_digits", importedDocs);
      } else if (importedCodes.length > 0) {
        existingPayersQuery = existingPayersQuery.in("payer_code", importedCodes);
      }

      const { data: existingPayers } = await existingPayersQuery;

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

      // Pre-fetch existing billings for imported payers (across reference months)
      const existingBillingsQuery = payerIds.length > 0
        ? await supabase
            .from("billings")
            .select("id, payer_id, status, reference_month, due_date, nosso_numero, seu_numero")
            .in("payer_id", payerIds)
        : { data: [] as { id: string; payer_id: string; status: string; reference_month: string; due_date: string | null; nosso_numero: string | null; seu_numero: string | null }[] };

      const existingBillings = existingBillingsQuery.data || [];

      const existingBillingsMap = new Map<string, (typeof existingBillings)[number]>();
      const existingBillingsByBase = new Map<string, (typeof existingBillings)[number][]>();

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

        const baseKey = getBillingBaseLookupKey({
          payer_id: billingRow.payer_id,
          reference_month: billingRow.reference_month,
          nosso_numero: billingRow.nosso_numero,
          seu_numero: billingRow.seu_numero,
          due_date: billingRow.due_date,
        });
        const list = existingBillingsByBase.get(baseKey) || [];
        const next = list.filter((x) => x.id !== billingRow.id);
        next.push(billingRow);
        existingBillingsByBase.set(baseKey, next);
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

        const existingVariants = Array.from(
          new Map(
            baseKeys
              .flatMap((k) => existingBillingsByBase.get(k) || [])
              .map((b) => [b.id, b])
          ).values()
        );
        const sameStatus = existingVariants.find((b) => b.status === billing.status);
        const hasPaidVariant = existingVariants.some((b) => b.status === "PAID");
        const openVariant = existingVariants.find((b) => b.status === "OPEN");
        const cancelVariant = existingVariants.find((b) => b.status === "CANCELADO");

        const billingData = {
          payer_id: payerId,
          payer_code: billing.payer_code,
          nosso_numero: billing.nosso_numero,
          seu_numero: billing.seu_numero,
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
        };

        const registerPlannedUpdate = (targetId: string, status: string) => {
          const updatedPayload = { ...billingData, status };
          updateBillings.push({ id: targetId, data: updatedPayload });

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

        if (sameStatus) {
          const dueDateChanged = (sameStatus.due_date || null) !== (billingData.due_date || null);
          const nossoChanged = (sameStatus.nosso_numero || null) !== (billingData.nosso_numero || null);
          const seuChanged = (sameStatus.seu_numero || null) !== (billingData.seu_numero || null);
          if (dueDateChanged || nossoChanged || seuChanged) {
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
        } else if (billing.status === "OPEN" && hasPaidVariant) {
          // Ignore OPEN if already paid in the same billing base
        } else {
          registerPlannedInsert(billing.status);
        }

        // Accumulate payer updates
        const needsReview =
          billing.status === "NEEDS_REVIEW" ||
          isQuickCancellation(billing.due_date, billing.liquidation_at);

        const payerUpdate: any = {
          billing_seen_in_month: billing.reference_month,
          last_billing_ref: billing.reference_month,
          status: "ATIVO",
          billing_mode: "BOLETO",
          default_route: payerRoute,
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
          .upsert(payersToCreate, { onConflict: "id" });

        if (error) {
          console.warn("Error creating placeholder payers:", error);
        }
      }

      setProgress(40);

      // Insert new billings in batches
      for (let i = 0; i < newBillings.length; i += BATCH_SIZE_BILLINGS) {
        const batch = newBillings.slice(i, i + BATCH_SIZE_BILLINGS);
        try {
          const { error } = await supabase.from("billings").insert(batch);
          if (error) throw error;
          result.success += batch.length;
        } catch (err: any) {
          // Fallback to individual inserts
          for (const b of batch) {
            try {
              const { error } = await supabase.from("billings").insert(b);
              if (error) {
                result.errors++;
                result.errorDetails.push({ row: 0, error: error.message });
              } else {
                result.success++;
              }
            } catch (e: any) {
              result.errors++;
              result.errorDetails.push({ row: 0, error: e.message });
            }
          }
        }
        setProgress(40 + Math.round((i / newBillings.length) * 30));
      }

      setProgress(70);

      // Update existing billings
      for (const { id, data } of updateBillings) {
        try {
          await supabase.from("billings").update(data).eq("id", id);
          result.success++;
        } catch (err: any) {
          result.errors++;
          result.errorDetails.push({ row: 0, error: err.message });
        }
      }

      setProgress(85);

      // Update payers in batch
      const payerUpdateEntries = Array.from(payerUpdates.entries());
      for (let i = 0; i < payerUpdateEntries.length; i += BATCH_SIZE_PAYERS) {
        const batch = payerUpdateEntries.slice(i, i + BATCH_SIZE_PAYERS);
        await Promise.all(
          batch.map(([id, update]) =>
            supabase.from("payers").update(update).eq("id", id)
          )
        );
      }

      setProgress(95);

      result.payerUpdatesChanged = payerUpdates.size;
      result.payerUpdatesUnchanged = Math.max(0, importedPayerIds.size - payerUpdates.size);

      // Deactivate payers not in import
      if (result.referenceMonth) {
        await applyPayerMonthStatus(result.referenceMonth, payerMonthStatus);
        await deactivatePayersNotInImport(result.referenceMonth, payerIdsInImport);
      }

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

      const payerSummary =
        typeof result.payerUpdatesChanged === "number" && typeof result.payerUpdatesUnchanged === "number"
          ? ` Pagadores alterados: ${result.payerUpdatesChanged}. Sem mudanca: ${result.payerUpdatesUnchanged}.`
          : "";

      if (result.errors > 0) {
        toast.warning(`Importacao: ${result.success} OK, ${result.errors} erros.${payerSummary}`);
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
  const { data: activePayers } = await supabase
    .from("payers")
    .select("id, billing_mode, is_coordinator, manual_active_until, needs_review")
    .eq("status", "ATIVO");

  if (!activePayers) return;

  const payersToDeactivate: string[] = [];
  const mixedToReview: string[] = [];

  for (const payer of activePayers) {
    if (payerIdsInImport.has(payer.id)) continue;
    if (payer.is_coordinator) continue;
    if (payer.manual_active_until && payer.manual_active_until >= referenceMonth)
      continue;

    if (payer.billing_mode === "PIX_ONLY") continue;

    if (payer.billing_mode === "MIXED") {
      if (!payer.needs_review) mixedToReview.push(payer.id);
      continue;
    }

    payersToDeactivate.push(payer.id);
  }

  if (payersToDeactivate.length > 0) {
    // Batch update in chunks
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
