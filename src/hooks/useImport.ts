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
      const { data: importLog } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "PAGADORES",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const payer = transformPayerRow(row);
          if (!payer) {
            result.errors++;
            result.errorDetails.push({ row: i + 2, error: "Dados inválidos (sem nome ou identificador)" });
            continue;
          }

          // Upsert payer
          const { error } = await supabase
            .from("payers")
            .upsert(payer, { onConflict: "id" });

          if (error) {
            result.errors++;
            result.errorDetails.push({ row: i + 2, error: error.message });
          } else {
            result.success++;
          }
        } catch (err) {
          result.errors++;
          result.errorDetails.push({ row: i + 2, error: String(err) });
        }

        setProgress(Math.round(((i + 1) / rows.length) * 100));
      }

      // Update import log
      if (importLog) {
        await supabase
          .from("import_logs")
          .update({
            status: result.errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
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
    mutationFn: async (file: File): Promise<ImportResult> => {
      const rows = await parseCSV<BillingCSVRow>(file);
      const result: ImportResult = {
        total: rows.length,
        success: 0,
        errors: 0,
        errorDetails: [],
      };

      // Create import log
      const { data: importLog } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "BOLETOS",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

      // Group billings by payer_code + reference_month for conflict resolution
      const billingMap = new Map<string, ReturnType<typeof transformBillingRow>>();

      for (const row of rows) {
        const billing = transformBillingRow(row);
        if (!billing) continue;

        const key = `${billing.payer_code}-${billing.reference_month}`;
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
      }

      const billings = Array.from(billingMap.values());
      
      for (let i = 0; i < billings.length; i++) {
        const billing = billings[i];
        if (!billing) continue;

        try {
          // Find payer by payer_code
          const { data: payer } = await supabase
            .from("payers")
            .select("id")
            .eq("payer_code", billing.payer_code)
            .maybeSingle();

          if (!payer) {
            result.errors++;
            result.errorDetails.push({ 
              row: i + 1, 
              error: `Pagador não encontrado: ${billing.payer_code}` 
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

          const billingData = {
            ...billing,
            payer_id: payer.id,
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

          // Update payer's last billing info
          await supabase
            .from("payers")
            .update({
              billing_seen_in_month: billing.reference_month,
              last_billing_ref: billing.reference_month,
              ...(billing.status === "PAID" && { last_payment_at: new Date().toISOString() }),
            })
            .eq("id", payer.id);

          result.success++;
        } catch (err: any) {
          result.errors++;
          result.errorDetails.push({ row: i + 1, error: err.message || String(err) });
        }

        setProgress(Math.round(((i + 1) / billings.length) * 100));
      }

      // Update import log
      if (importLog) {
        await supabase
          .from("import_logs")
          .update({
            status: result.errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
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
      const { data: importLog } = await supabase
        .from("import_logs")
        .insert({
          file_name: file.name,
          type: "CEPS",
          total_rows: rows.length,
          status: "PROCESSING",
        })
        .select()
        .single();

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
        await supabase
          .from("import_logs")
          .update({
            status: result.errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
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
