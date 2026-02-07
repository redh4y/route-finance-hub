-- Tabela de CEPs para lookup de endereços
CREATE TABLE public.ceps (
  cep VARCHAR(8) PRIMARY KEY,
  logradouro TEXT,
  bairro TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Pagadores (Alunos)
CREATE TABLE public.payers (
  id TEXT PRIMARY KEY, -- documentDigits ou payerCode
  name TEXT NOT NULL,
  name_lower TEXT GENERATED ALWAYS AS (lower(name)) STORED,
  document TEXT,
  document_digits TEXT,
  document_valid BOOLEAN DEFAULT false,
  payer_code TEXT,
  address_original TEXT,
  match_ok BOOLEAN DEFAULT false,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  cep VARCHAR(8),
  city TEXT,
  state VARCHAR(2),
  address_base TEXT,
  review_status TEXT,
  review_reason TEXT,
  review_flag BOOLEAN DEFAULT false,
  review_address BOOLEAN DEFAULT false,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  billing_mode TEXT NOT NULL DEFAULT 'BOLETO' CHECK (billing_mode IN ('BOLETO', 'PIX_ONLY', 'MIXED')),
  manual_active_until TEXT, -- YYYY-MM format
  is_coordinator BOOLEAN DEFAULT false,
  billing_seen_in_month TEXT, -- YYYY-MM format
  last_billing_ref TEXT,
  last_payment_at TIMESTAMP WITH TIME ZONE,
  needs_review BOOLEAN DEFAULT false,
  default_route TEXT DEFAULT 'DESCONHECIDO' CHECK (default_route IN ('BARRETOS', 'FRANCA', 'DESCONHECIDO')),
  pix_monthly_amount_cents INTEGER,
  pix_due_day INTEGER,
  route TEXT,
  extra_contacts JSONB DEFAULT '[]'::jsonb,
  change_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para payers
CREATE INDEX idx_payers_status ON public.payers(status);
CREATE INDEX idx_payers_billing_mode ON public.payers(billing_mode);
CREATE INDEX idx_payers_name_lower ON public.payers(name_lower);
CREATE INDEX idx_payers_document_digits ON public.payers(document_digits);
CREATE INDEX idx_payers_payer_code ON public.payers(payer_code);
CREATE INDEX idx_payers_cep ON public.payers(cep);
CREATE INDEX idx_payers_neighborhood ON public.payers(neighborhood);
CREATE INDEX idx_payers_default_route ON public.payers(default_route);

-- Tabela de Billings (Boletos/Cobranças)
CREATE TABLE public.billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id TEXT NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  payer_code TEXT,
  reference_month TEXT NOT NULL, -- YYYY-MM format
  due_date DATE,
  liquidation_at DATE, -- Data Baixa
  settlement_at DATE, -- Data Pagamento
  amount_expected_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PAID', 'NEEDS_REVIEW', 'CANCELADO')),
  payment_method TEXT DEFAULT 'BOLETO' CHECK (payment_method IN ('BOLETO', 'PIX', 'MANUAL')),
  route TEXT, -- BOLETO/PIX/REEMISSAO/CANCELADO
  nosso_numero TEXT,
  seu_numero TEXT,
  source TEXT DEFAULT 'IMPORT',
  source_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(payer_id, reference_month, nosso_numero)
);

-- Índices para billings
CREATE INDEX idx_billings_payer_id ON public.billings(payer_id);
CREATE INDEX idx_billings_reference_month ON public.billings(reference_month);
CREATE INDEX idx_billings_status ON public.billings(status);
CREATE INDEX idx_billings_due_date ON public.billings(due_date);

-- Tabela de Lançamentos Financeiros
CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competence_month TEXT NOT NULL, -- YYYY-MM format
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RECEITA', 'CUSTO', 'DESPESA', 'OUTRAS')),
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  cost_center_code TEXT,
  payment_method TEXT,
  cost_type TEXT,
  card_id TEXT,
  installments_total INTEGER,
  vehicle_id TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'BILLING', 'FATURA', 'IMPORT')),
  payer_id TEXT REFERENCES public.payers(id) ON DELETE SET NULL,
  billing_id UUID REFERENCES public.billings(id) ON DELETE SET NULL,
  expense_id TEXT,
  parent_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para financial_entries
CREATE INDEX idx_financial_entries_competence_month ON public.financial_entries(competence_month);
CREATE INDEX idx_financial_entries_type ON public.financial_entries(type);
CREATE INDEX idx_financial_entries_category ON public.financial_entries(category);
CREATE INDEX idx_financial_entries_date ON public.financial_entries(date);
CREATE INDEX idx_financial_entries_source ON public.financial_entries(source);
CREATE INDEX idx_financial_entries_parent_entry_id ON public.financial_entries(parent_entry_id);

-- Tabela de categorias para DRE
CREATE TABLE public.dre_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('RECEITA', 'CUSTO', 'DESPESA', 'OUTRAS')),
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(type, category, subcategory)
);

-- Inserir categorias padrão do DRE
INSERT INTO public.dre_categories (type, category, subcategory, display_order) VALUES
-- Receitas
('RECEITA', 'Mensalidades', 'Transporte Universitário', 1),
('RECEITA', 'Mensalidades', 'Fretamento', 2),
('RECEITA', 'Viagens Extras', NULL, 3),
('RECEITA', 'Outros', NULL, 4),
-- Custos (direto da operação)
('CUSTO', 'Combustível', NULL, 10),
('CUSTO', 'Manutenção', 'Preventiva', 11),
('CUSTO', 'Manutenção', 'Corretiva', 12),
('CUSTO', 'Pneus', NULL, 13),
('CUSTO', 'Pedágio', NULL, 14),
('CUSTO', 'Motoristas', 'Salários', 15),
('CUSTO', 'Motoristas', 'Encargos', 16),
('CUSTO', 'Seguro Veículos', NULL, 17),
('CUSTO', 'Licenciamento', NULL, 18),
-- Despesas (administrativo)
('DESPESA', 'Pro-labore', NULL, 20),
('DESPESA', 'Internet', NULL, 21),
('DESPESA', 'Sistemas', NULL, 22),
('DESPESA', 'Marketing', NULL, 23),
('DESPESA', 'Contabilidade', NULL, 24),
('DESPESA', 'Aluguel', NULL, 25),
('DESPESA', 'Telefone', NULL, 26),
('DESPESA', 'Material de Escritório', NULL, 27),
-- Outras
('OUTRAS', 'Juros', 'Recebidos', 30),
('OUTRAS', 'Juros', 'Pagos', 31),
('OUTRAS', 'Multas', NULL, 32);

-- Tabela de logs de importação
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('PAYERS', 'BILLINGS', 'CEPS', 'INVOICES')),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_payers_updated_at
  BEFORE UPDATE ON public.payers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billings_updated_at
  BEFORE UPDATE ON public.billings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.ceps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dre_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Acesso público para leitura (sistema interno)
-- Em produção, deve-se restringir por usuário/empresa

-- CEPs - Leitura pública
CREATE POLICY "CEPs são visíveis para todos" 
  ON public.ceps FOR SELECT 
  USING (true);

CREATE POLICY "CEPs podem ser inseridos por todos" 
  ON public.ceps FOR INSERT 
  WITH CHECK (true);

-- Payers - CRUD completo (sistema interno)
CREATE POLICY "Payers são visíveis para todos" 
  ON public.payers FOR SELECT 
  USING (true);

CREATE POLICY "Payers podem ser inseridos por todos" 
  ON public.payers FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Payers podem ser atualizados por todos" 
  ON public.payers FOR UPDATE 
  USING (true);

CREATE POLICY "Payers podem ser deletados por todos" 
  ON public.payers FOR DELETE 
  USING (true);

-- Billings - CRUD completo
CREATE POLICY "Billings são visíveis para todos" 
  ON public.billings FOR SELECT 
  USING (true);

CREATE POLICY "Billings podem ser inseridos por todos" 
  ON public.billings FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Billings podem ser atualizados por todos" 
  ON public.billings FOR UPDATE 
  USING (true);

CREATE POLICY "Billings podem ser deletados por todos" 
  ON public.billings FOR DELETE 
  USING (true);

-- Financial Entries - CRUD completo
CREATE POLICY "Financial entries são visíveis para todos" 
  ON public.financial_entries FOR SELECT 
  USING (true);

CREATE POLICY "Financial entries podem ser inseridos por todos" 
  ON public.financial_entries FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Financial entries podem ser atualizados por todos" 
  ON public.financial_entries FOR UPDATE 
  USING (true);

CREATE POLICY "Financial entries podem ser deletados por todos" 
  ON public.financial_entries FOR DELETE 
  USING (true);

-- DRE Categories - Leitura pública
CREATE POLICY "DRE categories são visíveis para todos" 
  ON public.dre_categories FOR SELECT 
  USING (true);

CREATE POLICY "DRE categories podem ser inseridos por todos" 
  ON public.dre_categories FOR INSERT 
  WITH CHECK (true);

-- Import Logs - CRUD completo
CREATE POLICY "Import logs são visíveis para todos" 
  ON public.import_logs FOR SELECT 
  USING (true);

CREATE POLICY "Import logs podem ser inseridos por todos" 
  ON public.import_logs FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Import logs podem ser atualizados por todos" 
  ON public.import_logs FOR UPDATE 
  USING (true);