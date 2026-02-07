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
          result.errorDetails.push({ row: t.rowNumber, error: "Dados inválidos (sem nome ou identificador)" });
          return false;
        }
        return true;
      }) as Array<{ rowNumber: number; payer: NonNullable<ReturnType<typeof transformPayerRow>> }>;

      for (let i = 0; i < valid.length; i += batchSize) {
        const batchItems = valid.slice(i, i + batchSize);
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

        setProgress(Math.round((Math.min(i + batchSize, valid.length) / Math.max(valid.length, 1)) * 100));
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      if (result.errors > 0) {
        toast.warning(`Importação concluída: ${result.success} sucesso, ${result.errors} erros`);
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

      // Group billings by payer_id + reference_month for conflict resolution
      const billingMap = new Map<string, ReturnType<typeof transformBillingRow>>();
      const payerIdsInImport = new Set<string>();

      for (const row of rows) {
        const billing = transformBillingRow(row);
        if (!billing) continue;

        const key = `${billing.payer_id}-${billing.reference_month}`;
        const existing = billingMap.get(key);

        if (existing) {
          // Use higher priority status
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
        
        // Track reference month (should be consistent across file)
        if (!result.referenceMonth && billing.reference_month) {
          result.referenceMonth = billing.reference_month;
        }
      }

      const billings = Array.from(billingMap.values());
      
      for (let i = 0; i < billings.length; i++) {
        const billing = billings[i];
        if (!billing) continue;

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

          // Check for existing billing
          const { data: existingBilling } = await supabase
            .from("billings")
            .select("id, status")
            .eq("payer_id", payer.id)
            .eq("reference_month", billing.reference_month)
            .maybeSingle();

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

          if (existingBilling) {
            // Update existing billing if new status has higher priority
            const newStatus = getHigherPriorityStatus(
              billing.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW",
              existingBilling.status as "PAID" | "OPEN" | "CANCELADO" | "NEEDS_REVIEW"
            );

            if (newStatus !== existingBilling.status) {
              const { error } = await supabase
                .from("billings")
                .update({ ...billingData, status: newStatus })
                .eq("id", existingBilling.id);

              if (error) throw error;
            }
          } else {
            // Insert new billing
            const { error } = await supabase
              .from("billings")
              .insert(billingData);

            if (error) throw error;
          }

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
          };

          if (billing.status === "PAID" && billing.settlement_at) {
            payerUpdate.last_payment_at = billing.settlement_at;
          }

          if (needsReview) {
            payerUpdate.needs_review = true;
          }

          await supabase
            .from("payers")
            .update(payerUpdate)
            .eq("id", payer.id);

          result.success++;
        } catch (err: any) {
          result.errors++;
          result.errorDetails.push({ row: i + 1, error: err.message || String(err) });
        }

        setProgress(Math.round(((i + 1) / billings.length) * 100));
      }

      // Automatic payer deactivation logic
      if (result.referenceMonth) {
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
      
      if (result.errors > 0) {
        toast.warning(`Importação concluída: ${result.success} sucesso, ${result.errors} erros`);
      } else {
        toast.success(`${result.success} boletos importados com sucesso!`);
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
  // First try to find by id (document_digits)
  let { data: payer } = await supabase
    .from("payers")
    .select("id")
    .eq("id", billing.payer_id)
    .maybeSingle();

  if (payer) return payer;

  // Try to find by payer_code
  if (billing.payer_code) {
    const { data: payerByCode } = await supabase
      .from("payers")
      .select("id")
      .eq("payer_code", billing.payer_code)
      .maybeSingle();

    if (payerByCode) return payerByCode;
  }

  // Create placeholder payer if not found
  // Note: name_lower is a generated column, so we don't include it
  const placeholderPayer = {
    id: billing.payer_id,
    name: billing.payer_name || `Pagador ${billing.payer_code || billing.payer_id}`,
    document: billing.payer_id,
    document_digits: billing.payer_id,
    payer_code: billing.payer_code,
    status: "ATIVO",
    billing_mode: "BOLETO",
    review_flag: true,
    needs_review: true,
  };

  const { data: newPayer, error } = await supabase
    .from("payers")
    .insert(placeholderPayer)
    .select("id")
    .single();

  if (error) {
    console.error("Error creating placeholder payer:", error);
    return null;
  }

  return newPayer;
}

// Deactivate payers that didn't appear in the import
async function deactivatePayersNotInImport(referenceMonth: string, payerIdsInImport: Set<string>) {
  // Get all BOLETO payers that should be checked
  const { data: activePayers } = await supabase
    .from("payers")
    .select("id, billing_mode, is_coordinator, manual_active_until")
    .eq("status", "ATIVO")
    .eq("billing_mode", "BOLETO");

  if (!activePayers) return;

  const payersToDeactivate: string[] = [];

  for (const payer of activePayers) {
    // Skip if payer appeared in import
    if (payerIdsInImport.has(payer.id)) continue;

    // Skip coordinators
    if (payer.is_coordinator) continue;

    // Skip if manual_active_until is set and >= current reference month
    if (payer.manual_active_until && payer.manual_active_until >= referenceMonth) continue;

    payersToDeactivate.push(payer.id);
  }

  if (payersToDeactivate.length > 0) {
    await supabase
      .from("payers")
      .update({ status: "INATIVO" })
      .in("id", payersToDeactivate);
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
