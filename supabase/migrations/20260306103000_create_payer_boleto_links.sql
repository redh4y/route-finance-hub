-- Portal de boletos por WhatsApp + CPF (sem version/status)
create table if not exists public.payer_boleto_links (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null check (reference_month ~ '^\d{4}-\d{2}$'),
  payer_id uuid null references public.payers(id) on delete set null,
  student_name text not null,
  cpf_digits varchar(11) not null,
  phone_digits varchar(20) not null,
  drive_url text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_payer_boleto_links_ref_cpf_phone_url
  on public.payer_boleto_links(reference_month, cpf_digits, phone_digits, drive_url);

create index if not exists idx_payer_boleto_links_cpf_phone
  on public.payer_boleto_links(cpf_digits, phone_digits);

create index if not exists idx_payer_boleto_links_ref_month
  on public.payer_boleto_links(reference_month desc);

alter table public.payer_boleto_links enable row level security;

drop policy if exists "payer_boleto_links_select_auth" on public.payer_boleto_links;
create policy "payer_boleto_links_select_auth"
  on public.payer_boleto_links
  for select
  to authenticated
  using (true);

drop policy if exists "payer_boleto_links_insert_auth" on public.payer_boleto_links;
create policy "payer_boleto_links_insert_auth"
  on public.payer_boleto_links
  for insert
  to authenticated
  with check (true);

drop policy if exists "payer_boleto_links_update_auth" on public.payer_boleto_links;
create policy "payer_boleto_links_update_auth"
  on public.payer_boleto_links
  for update
  to authenticated
  using (true)
  with check (true);
