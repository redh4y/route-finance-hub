alter table public.payers
  add column if not exists birth_date date;

create index if not exists idx_payers_birth_date on public.payers (birth_date);
