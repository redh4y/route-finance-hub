
-- Add run_id to financial_entries, billings, and payers
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS run_id uuid;
ALTER TABLE public.billings ADD COLUMN IF NOT EXISTS run_id uuid;
ALTER TABLE public.payers ADD COLUMN IF NOT EXISTS run_id uuid;

-- Add diff_summary to import_logs for detailed diff tracking
ALTER TABLE public.import_logs ADD COLUMN IF NOT EXISTS run_id uuid;
ALTER TABLE public.import_logs ADD COLUMN IF NOT EXISTS diff_summary jsonb DEFAULT '{}'::jsonb;

-- Create indexes for run_id lookups
CREATE INDEX IF NOT EXISTS idx_financial_entries_run_id ON public.financial_entries(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billings_run_id ON public.billings(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payers_run_id ON public.payers(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_logs_run_id ON public.import_logs(run_id) WHERE run_id IS NOT NULL;
