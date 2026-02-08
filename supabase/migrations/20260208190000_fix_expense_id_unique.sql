-- Ensure expense_id has a full unique index for ON CONFLICT
DROP INDEX IF EXISTS public.idx_financial_entries_expense_id;

CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_expense_id_key
ON public.financial_entries(expense_id);
