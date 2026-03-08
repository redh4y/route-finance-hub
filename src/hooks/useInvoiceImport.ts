import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildContractsAndExpenses, ParsedInvoiceLine, InstallmentContract, ExpenseEntry } from "@/lib/invoice-import";

export type InvoiceImportInput = {
  parsedLines: ParsedInvoiceLine[];
  cardId: string;
  cardName: string | null;
  provider: "sicredi" | "generic";
  invoiceMonthOverride: string;
  closingDay?: number;
  dueDay?: number;
  costCenterCode?: string;
  category?: string;
};

export type InvoiceImportResult = {
  parsed: number;
  contracts: number;
  expenses: number;
};

export function useInvoiceImport() {
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: InvoiceImportInput): Promise<InvoiceImportResult> => {
      if (input.parsedLines.length === 0) {
        throw new Error("Nenhuma linha válida para importar");
      }

      setProgress(10);

      const runId = crypto.randomUUID();
      const { contracts, expenses } = buildContractsAndExpenses(input.parsedLines, {
        cardId: input.cardId,
        cardName: input.cardName,
        provider: input.provider,
        costCenterCode: input.costCenterCode ?? "GERAL",
        category: input.category ?? "CARTAO_CREDITO",
        invoiceMonthOverride: input.invoiceMonthOverride,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        runId,
      });

      setProgress(20);

      // Upsert installment_contracts
      if (contracts.length > 0) {
        const contractRecords = contracts.map((c) => ({
          id: c.id,
          provider: c.provider,
          card_id: c.card_id,
          card_name: c.card_name,
          purchase_date: c.purchase_date,
          merchant_base: c.merchant_base,
          installment_total: c.installment_total,
          installment_amount_cents: c.installment_amount_cents,
          run_id: c.run_id,
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < contractRecords.length; i += BATCH_SIZE) {
          const batch = contractRecords.slice(i, i + BATCH_SIZE);
          const { error } = await supabase
            .from("installment_contracts")
            .upsert(batch as any[], { onConflict: "id" });
          if (error) throw new Error(`Erro ao inserir contratos: ${error.message}`);
        }
      }

      setProgress(50);

      // Fetch existing expense_ids to preserve REAL status
      const expenseIds = expenses.map((e) => e.expense_id);
      const { data: existing } = await supabase
        .from("financial_entries")
        .select("expense_id, status, group_id, subgroup_id, type, category, subcategory")
        .in("expense_id", expenseIds);

      const existingMap = new Map<string, {
        status: string;
        group_id: string | null;
        subgroup_id: string | null;
        type: string | null;
        category: string | null;
        subcategory: string | null;
      }>(
        (existing || [])
          .filter((e): e is {
            expense_id: string;
            status: string;
            group_id: string | null;
            subgroup_id: string | null;
            type: string | null;
            category: string | null;
            subcategory: string | null;
          } => !!e.expense_id && !!e.status)
          .map((e) => [
            e.expense_id,
            {
              status: e.status,
              group_id: e.group_id ?? null,
              subgroup_id: e.subgroup_id ?? null,
              type: e.type ?? null,
              category: e.category ?? null,
              subcategory: e.subcategory ?? null,
            },
          ])
      );

      setProgress(60);

      // Prepare expenses, preserving REAL status
      const finalExpenses = expenses.map((e) => {
        const existingEntry = existingMap.get(e.expense_id);
        // Never downgrade REAL to PREVISTO
        const finalStatus = existingEntry?.status === "REAL" && e.status === "PREVISTO" 
          ? "REAL" 
          : e.status;

        const hasClassification = !!existingEntry?.group_id;

        return {
          expense_id: e.expense_id,
          contract_id: e.contract_id,
          description: e.description,
          amount_cents: e.amount_cents,
          status: finalStatus,
          date: e.date,
          operation_date: e.operation_date,
          competence_month: e.competence_month,
          invoice_month: e.invoice_month,
          card_id: e.card_id,
          cost_center_code: e.cost_center_code,
          category: hasClassification ? (existingEntry?.category || e.category) : e.category,
          subcategory: hasClassification ? (existingEntry?.subcategory || e.subcategory) : e.subcategory,
          type: hasClassification ? ((existingEntry?.type as "RECEITA" | "CUSTO" | "DESPESA" | "OUTRAS" | null) || e.type) : e.type,
          source: "FATURA",
          group_id: hasClassification ? existingEntry?.group_id : null,
          subgroup_id: hasClassification ? existingEntry?.subgroup_id : null,
          needs_classification: hasClassification ? false : true,
          needs_review: hasClassification ? false : true,
          review_reasons: hasClassification ? [] : ["MISSING_GROUP"],
          installments_total: e.installments_total,
          installment_current: e.installment_current ?? null,
          installment_total: e.installment_total ?? null,
          parent_entry_id: e.parent_entry_id,
          payment_method: "CARTAO_CREDITO",
        };
      });

      setProgress(80);

      // Upsert financial_entries in batches
      const EXPENSE_BATCH_SIZE = 100;
      for (let i = 0; i < finalExpenses.length; i += EXPENSE_BATCH_SIZE) {
        const batch = finalExpenses.slice(i, i + EXPENSE_BATCH_SIZE);
        const { error } = await supabase
          .from("financial_entries")
          .upsert(batch as any[], { onConflict: "expense_id" });
        if (error) throw new Error(`Erro ao inserir despesas: ${error.message}`);
        
        setProgress(80 + Math.floor((i / finalExpenses.length) * 20));
      }

      // Create import log for this invoice run
      const { data: importLog } = await supabase
        .from("import_logs")
        .insert({
          file_name: `fatura-${input.cardName || input.cardId}-${input.invoiceMonthOverride}`,
          type: "INVOICE",
          total_rows: input.parsedLines.length,
          status: "COMPLETED",
          run_id: runId,
          processed_rows: input.parsedLines.length,
          success_rows: expenses.length,
          error_rows: 0,
          completed_at: new Date().toISOString(),
          diff_summary: {
            contracts: contracts.length,
            expenses: expenses.length,
            parsed: input.parsedLines.length,
          },
        })
        .select("id")
        .single();

      setProgress(100);

      return {
        parsed: input.parsedLines.length,
        contracts: contracts.length,
        expenses: expenses.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
      toast.success(`Importação OK: ${result.expenses} parcelas, ${result.contracts} contratos`);
      setProgress(0);
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
      setProgress(0);
    },
  });

  const reset = () => setProgress(0);

  return {
    importInvoice: mutation.mutateAsync,
    isImporting: mutation.isPending,
    progress,
    reset,
  };
}
