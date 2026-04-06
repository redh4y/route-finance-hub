-- Add unique constraint on our_number for upsert conflict resolution.
-- NOTE: plain unique index (no WHERE) is required for ON CONFLICT to work.
-- PostgreSQL natively allows multiple NULLs in a unique index, so nullable
-- rows are not a problem.
drop index if exists public.uq_payer_boleto_links_our_number;
drop index if exists public.idx_payer_boleto_links_our_number;
create unique index uq_payer_boleto_links_our_number
  on public.payer_boleto_links(our_number);
