import { useState } from "react";
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

const PAYER_UPDATE_FIELDS =
  "id, billing_seen_in_month, last_billing_ref, status, billing_mode, default_route, last_payment_at, needs_review";

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



export function useImportPayers() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ReturnType<typeof transformPayerRow>[]>([]);

  const parseFile = async (file: File) => {
    const rows = await parseCSV<PayerCSVRow>(file);
    const transformed = rows.map(transformPayerRow).filter(Boolean);
    setPreview(transformed as ReturnType<typeof transformPayerRow>[]);
    return transformed;
  };

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const rows = await parseCSV<PayerCSVRow>(file);
      const result: ImportResult = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
      };

      // Create import log
      const { data: importLog, error: importLogError } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "PAYERS",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (importLogError) {
        // Don't block import if logging fails
        console.warn("Failed to create import log:", importLogError);
      }

      // Transform rows with row numbers for precise error reporting
      const batchSize = 50;
      const transformed = rows.map((row, idx) => ({
        rowNumber: idx + 2, // header is line 1
        payer: transformPayerRow(row),
      }));

      const valid = transformed.filter((t) => {
        if (!t.payer) {
          result.errors++;
          result.errorDetails.push({ row: t.rowNumber, error: "Dados inv?lidos (sem nome ou identificador)" });
          return false;
        }
        return true;
      }) as Array<{ rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>> }>;

      const documentDigits = Array.from(
        new Set(valid.map((v) => v.payer.document_digits).filter((d): d is string => !!d))
      );
      const payerCodes = Array.from(
        new Set(valid.map((v) => v.payer.payer_code).filter((c): c is string => !!c))
      );

      let candidateQuery = supabase.from("payers").select("id, document_digits, payer_code");
      if (documentDigits.length > 0 && payerCodes.length > 0) {
        candidateQuery = candidateQuery.or(
          `document_digits.in.(${documentDigits.map((d) => `"${d}"`).join(",")}),payer_code.in.(${payerCodes.map((c) => `"${c}"`).join(",")})`
        );
      } else if (documentDigits.length > 0) {
        candidateQuery = candidateQuery.in("document_digits", documentDigits);
      } else if (payerCodes.length > 0) {
        candidateQuery = candidateQuery.in("payer_code", payerCodes);
      }

      const { data: candidatePayers, error: candidateError } = await candidateQuery;
      if (candidateError) throw candidateError;

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

      const resolvedValid = valid
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

      for (let i = 0; i < resolvedValid.length; i += batchSize) {

        const batchItems = resolvedValid.slice(i, i + batchSize);
        const batch = batchItems.map((b) => b.payer);

        try {
          const { error } = await supabase
            .from("payers")
            .upsert(batch as any[], { onConflict: "id" });

          if (error) throw error;
          result.success += batchItems.length;
        } catch (err: any) {
          // If the batch fails (e.g. due to one invalid row), fallback to per-row upsert to pinpoint errors
          for (const item of batchItems) {
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
          }
        }

        setProgress(Math.round((Math.min(i + batchSize, resolvedValid.length) / Math.max(resolvedValid.length, 1)) * 100));
      }

      // Update import log
      if (importLog) {
        const finalStatus = result.success === 0 && result.errors > 0 ? "FAILED" : "COMPLETED";

        await supabase
          .from("import_logs")
          .update({
            status: finalStatus,
            processed_rows: rows.length,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails,
            completed_at: new Date().toISOString(),
          })
          .eq("id", importLog.id);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payers"] });

      if (result.errors > 0) {
        toast.warning(`Importa??o conclu?da: ${result.success} sucesso, ${result.errors} erros`);
      } else {
        toast.success(`${result.success} pagadores importados com sucesso!`);
      }
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });

  return {
    importPayers: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    preview,
    parseFile,
    reset: () => {
      setProgress(0);
      setPreview([]);
    },
  };
}

export function useImportBillings() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ReturnType<typeof transformBillingRow>[]>([]);

  const parseFile = async (file: File) => {
    const rows = await parseCSV<BillingCSVRow>(file);
    const transformed = rows.map(transformBillingRow).filter(Boolean);
    setPreview(transformed as ReturnType<typeof transformBillingRow>[]);
    return transformed;
  };

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
      const { data: importLog, error: importLogError } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "BILLINGS",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (importLogError) {
        console.warn("Failed to create import log:", importLogError);
      }

      // Keep history of all emitted billings; dedupe only exact same billing identity inside the file
      const billingMap = new Map<string, TransformedBilling>();
      const payerIdsInImport = new Set<string>();
      const payerMonthStatus = new Map<string, "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW">();
      const importedPayerIds = new Set<string>();
      const changedPayerIds = new Set<string>();

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
      
      for (let i = 0; i < billings.length; i++) {
        const billing = billings[i];
        if (!billing) continue;

        const payerRoute =
          billing.amount_expected_cents > 50000 ? "FRANCA" : "BARRETOS";

        try {
          // Find payer by id (document_digits) or payer_code
          let payer = await findOrCreatePayer(billing);
          
          if (!payer) {
            result.errors++;
            result.errorDetails.push({ 
              row: i + 1, 
              error: `Não foi possível encontrar ou criar pagador: ${billing.payer_id}` 
            });
            continue;
          }
          payerIdsInImport.add(payer.id);
          importedPayerIds.add(payer.id);

          // Check existing billings for same identity base
          let existingBillingQuery = supabase
            .from("billings")
            .select("id, status, due_date, created_at")
            .eq("payer_id", payer.id)
            .eq("reference_month", billing.reference_month);

          if (billing.nosso_numero) {
            existingBillingQuery = existingBillingQuery.eq("nosso_numero", billing.nosso_numero);
          } else {
            existingBillingQuery = existingBillingQuery.eq("seu_numero", billing.seu_numero || "");
            if (billing.due_date) {
              existingBillingQuery = existingBillingQuery.eq("due_date", billing.due_date);
            } else {
              existingBillingQuery = existingBillingQuery.is("due_date", null);
            }
          }

          const { data: existingVariants } = await existingBillingQuery.order("created_at", { ascending: false });
          const sameStatus = (existingVariants || []).find((b) => b.status === billing.status);
          const hasPaidVariant = (existingVariants || []).some((b) => b.status === "PAID");
          const openVariant = (existingVariants || []).find((b) => b.status === "OPEN");
          const cancelVariant = (existingVariants || []).find((b) => b.status === "CANCELADO");

          // Prepare billing data
          const billingData = {
            payer_id: payer.id,
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

          const upsertByStatusTransition = async () => {
            if (sameStatus) {
              const dueDateChanged = (sameStatus.due_date || null) !== (billingData.due_date || null);
              if (dueDateChanged) {
                const { error } = await supabase
                  .from("billings")
                  .update({ ...billingData, status: billing.status })
                  .eq("id", sameStatus.id);
                if (error) throw error;
              }
              return;
            }

            if (billing.status === "CANCELADO" && openVariant && !hasPaidVariant) {
              const { error } = await supabase
                .from("billings")
                .update({ ...billingData, status: "CANCELADO" })
                .eq("id", openVariant.id);
              if (error) throw error;
              return;
            }

            if ((billing.status === "PAID" || billing.status === "OPEN") && !hasPaidVariant) {
              const transitionTarget = openVariant || cancelVariant;
              if (transitionTarget) {
                const { error } = await supabase
                  .from("billings")
                  .update({ ...billingData, status: billing.status })
                  .eq("id", transitionTarget.id);
                if (error) throw error;
                return;
              }
            }

            if (billing.status === "OPEN" && hasPaidVariant) {
              return;
            }

            const { error } = await supabase
              .from("billings")
              .insert(billingData);
            if (error) throw error;
          };

          await upsertByStatusTransition();

          // Track payer status for the month (highest priority)
          const existingStatus = payerMonthStatus.get(payer.id);
          const nextStatus = existingStatus
            ? getHigherPriorityStatus(
                billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW",
                existingStatus
              )
            : (billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW");
          payerMonthStatus.set(payer.id, nextStatus);

          // Determine if payer needs review
          const needsReview = 
            billing.status === "NEEDS_REVIEW" ||
            isQuickCancellation(billing.due_date, billing.liquidation_at);

          // Update payer's billing info
          const payerUpdate: Record<string, any> = {
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

          if (hasPayerUpdateChanges(payer, payerUpdate)) {
            await supabase
              .from("payers")
              .update(payerUpdate)
              .eq("id", payer.id);
            Object.assign(payer, payerUpdate);
            changedPayerIds.add(payer.id);
          }

          result.success++;
        } catch (err: any) {
          result.errors++;
          result.errorDetails.push({ row: i + 1, error: err.message || String(err) });
        }

        setProgress(Math.round(((i + 1) / billings.length) * 100));
      }

      result.payerUpdatesChanged = changedPayerIds.size;
      result.payerUpdatesUnchanged = Math.max(0, importedPayerIds.size - changedPayerIds.size);

      // Automatic payer deactivation logic
      if (result.referenceMonth) {
        await applyPayerMonthStatus(result.referenceMonth, payerMonthStatus);
        await deactivatePayersNotInImport(result.referenceMonth, payerIdsInImport);
      }

      // Update import log
      if (importLog) {
        const finalStatus = result.success === 0 && result.errors > 0 ? "FAILED" : "COMPLETED";

        await supabase
          .from("import_logs")
          .update({
            status: finalStatus,
            processed_rows: billings.length,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails,
            completed_at: new Date().toISOString(),
          })
          .eq("id", importLog.id);
      }

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
        toast.warning(`Importacao concluida: ${result.success} sucesso, ${result.errors} erros.${payerSummary}`);
      } else {
        toast.success(`${result.success} boletos importados com sucesso!${payerSummary}`);
      }
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });

  return {
    importBillings: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    preview,
    parseFile,
    reset: () => {
      setProgress(0);
      setPreview([]);
    },
  };
}

// Helper function to find or create payer from billing data
async function findOrCreatePayer(billing: NonNullable<ReturnType<typeof transformBillingRow>>) {
  const looksLikeCpf = /^\d{11}$/.test(billing.payer_id || "");
  const docCandidate = looksLikeCpf ? billing.payer_id : null;
  const codeCandidate = billing.payer_code || (!looksLikeCpf ? billing.payer_id : null);

  if (docCandidate) {
    const { data: payerByDoc } = await supabase
      .from("payers")
      .select(PAYER_UPDATE_FIELDS)
      .eq("document_digits", docCandidate)
      .maybeSingle();
    if (payerByDoc) return payerByDoc;
  }

  if (codeCandidate) {
    const { data: payerByCode } = await supabase
      .from("payers")
      .select(PAYER_UPDATE_FIELDS)
      .eq("payer_code", codeCandidate)
      .maybeSingle();
    if (payerByCode) return payerByCode;
  }

  const placeholderPayer = {
    id: crypto.randomUUID(),
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
    default_route: billing.amount_expected_cents > 50000 ? "FRANCA" : "BARRETOS",
  };

  const { data: newPayer, error } = await supabase
    .from("payers")
    .insert([placeholderPayer])
    .select(PAYER_UPDATE_FIELDS)
    .single();

  if (error) {
    console.error("Error creating placeholder payer:", error);
    return null;
  }

  return newPayer;
}

// Deactivate payers that didn't appear in the import
async function deactivatePayersNotInImport(referenceMonth: string, payerIdsInImport: Set<string>) {
  // Get all active payers that should be checked
  const { data: activePayers } = await supabase
    .from("payers")
    .select("id, billing_mode, is_coordinator, manual_active_until, needs_review")
    .eq("status", "ATIVO");

  if (!activePayers) return;

  const payersToDeactivate: string[] = [];
  const mixedToReview: string[] = [];

  for (const payer of activePayers) {
    // Skip if payer appeared in import
    if (payerIdsInImport.has(payer.id)) continue;

    // Skip coordinators
    if (payer.is_coordinator) continue;

    // Skip if manual_active_until is set and >= current reference month
    if (payer.manual_active_until && payer.manual_active_until >= referenceMonth) continue;

    // PIX_ONLY is never auto-inactivated
    if (payer.billing_mode === "PIX_ONLY") continue;

    if (payer.billing_mode === "MIXED") {
      if (!payer.needs_review) mixedToReview.push(payer.id);
      continue;
    }

    // BOLETO: inactivate if not in import
    payersToDeactivate.push(payer.id);
  }

  if (payersToDeactivate.length > 0) {
    await supabase
      .from("payers")
      .update({ status: "INATIVO" })
      .eq("status", "ATIVO")
      .in("id", payersToDeactivate);
  }

  if (mixedToReview.length > 0) {
    await supabase
      .from("payers")
      .update({ needs_review: true })
      .in("id", mixedToReview);
  }
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
    await supabase
      .from("payers")
      .update({ status: "INATIVO" })
      .eq("status", "ATIVO")
      .in("id", toDeactivate);
  }

  if (toActivate.length > 0) {
    await supabase
      .from("payers")
      .update({ status: "ATIVO" })
      .neq("status", "ATIVO")
      .in("id", toActivate);
  }
}

export function useImportCEPs() {
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

      // Create import log
      const { data: importLog, error: importLogError } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "CEPS",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      if (importLogError) {
        console.warn("Failed to create import log:", importLogError);
      }

      // Batch insert for better performance
      const ceps = rows.map(transformCEPRow).filter(Boolean);
      const batchSize = 100;

      for (let i = 0; i < ceps.length; i += batchSize) {
        const batch = ceps.slice(i, i + batchSize);
        try {
          const { error } = await supabase
            .from("ceps")
            .upsert(batch as any[], { onConflict: "cep" });

          if (error) {
            result.errors += batch.length;
            result.errorDetails.push({ row: i, error: error.message });
          } else {
            result.success += batch.length;
          }
        } catch (err) {
          result.errors += batch.length;
          result.errorDetails.push({ row: i, error: String(err) });
        }

        setProgress(Math.round(((i + batchSize) / ceps.length) * 100));
      }

      // Update import log
      if (importLog) {
        const finalStatus = result.success === 0 && result.errors > 0 ? "FAILED" : "COMPLETED";

        await supabase
          .from("import_logs")
          .update({
            status: finalStatus,
            processed_rows: ceps.length,
            success_rows: result.success,
            error_rows: result.errors,
            errors: result.errorDetails,
            completed_at: new Date().toISOString(),
          })
          .eq("id", importLog.id);
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ceps"] });
      
      if (result.errors > 0) {
        toast.warning(`Importação concluída: ${result.success} sucesso, ${result.errors} erros`);
      } else {
        toast.success(`${result.success} CEPs importados com sucesso!`);
      }
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });

  return {
    importCEPs: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    reset: () => setProgress(0),
  };
}
