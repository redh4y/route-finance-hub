-- Adiciona rota e valor mensal aos grupos de viagem
ALTER TABLE public.payer_groups
  ADD COLUMN IF NOT EXISTS route text CHECK (route IN ('BARRETOS', 'FRANCA')),
  ADD COLUMN IF NOT EXISTS monthly_amount_cents integer;

-- Unique constraint em name para upsert por nome no import JSON
ALTER TABLE public.payer_groups
  ADD CONSTRAINT uq_payer_groups_name UNIQUE (name);
