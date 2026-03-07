-- Add JSON boleto fields and align uniqueness for 2a via import
alter table public.payer_boleto_links
  add column if not exists our_number text,
  add column if not exists digitable_line text,
  add column if not exists amount_cents integer,
  add column if not exists due_date date,
  add column if not exists file_id text,
  add column if not exists view_url text,
  add column if not exists source text default 'IMPORT';

-- Keep only one record per CPF + link (idempotent reimport)
drop index if exists public.uq_payer_boleto_links_ref_cpf_phone_url;
create unique index if not exists uq_payer_boleto_links_cpf_drive_url
  on public.payer_boleto_links(cpf_digits, drive_url);

-- Optional lookup indexes for new fields
create index if not exists idx_payer_boleto_links_our_number
  on public.payer_boleto_links(our_number);
create index if not exists idx_payer_boleto_links_due_date
  on public.payer_boleto_links(due_date desc);