-- Permite membros sem payer vinculado (importados sem match)
ALTER TABLE public.payer_group_members
  ALTER COLUMN payer_id DROP NOT NULL;

-- Status do match: ok | unmatched | review_ignored
ALTER TABLE public.payer_group_members
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS best_candidate_name text,
  ADD COLUMN IF NOT EXISTS best_candidate_score smallint;
