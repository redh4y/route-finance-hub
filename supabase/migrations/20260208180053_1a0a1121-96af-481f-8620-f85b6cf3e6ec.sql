-- Create installment_contracts table
CREATE TABLE public.installment_contracts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'sicredi',
  card_id TEXT NOT NULL,
  card_name TEXT,
  purchase_date DATE NOT NULL,
  merchant_base TEXT NOT NULL,
  installment_total INTEGER NOT NULL DEFAULT 1,
  installment_amount_cents INTEGER NOT NULL,
  run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to financial_entries
ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'REAL',
ADD COLUMN IF NOT EXISTS operation_date DATE,
ADD COLUMN IF NOT EXISTS invoice_month TEXT,
ADD COLUMN IF NOT EXISTS contract_id TEXT;

-- Create unique index on expense_id for deduplication (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_expense_id 
ON public.financial_entries(expense_id) 
WHERE expense_id IS NOT NULL;

-- Enable RLS on installment_contracts
ALTER TABLE public.installment_contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for installment_contracts
CREATE POLICY "Installment contracts são visíveis para todos" 
ON public.installment_contracts 
FOR SELECT 
USING (true);

CREATE POLICY "Installment contracts podem ser inseridos por todos" 
ON public.installment_contracts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Installment contracts podem ser atualizados por todos" 
ON public.installment_contracts 
FOR UPDATE 
USING (true);

CREATE POLICY "Installment contracts podem ser deletados por todos" 
ON public.installment_contracts 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_installment_contracts_updated_at
BEFORE UPDATE ON public.installment_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();