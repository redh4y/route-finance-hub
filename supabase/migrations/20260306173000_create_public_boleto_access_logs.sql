create table if not exists public.public_boleto_access_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null check (action in ('SEARCH', 'DOWNLOAD')),
  cpf_digits varchar(11) not null,
  reference_month text null,
  student_name text null,
  drive_url text null,
  found_count integer null,
  user_agent text null,
  request_id text null,
  source text not null default '2-via-boletos'
);

create index if not exists idx_public_boleto_access_logs_created_at
  on public.public_boleto_access_logs (created_at desc);

create index if not exists idx_public_boleto_access_logs_cpf
  on public.public_boleto_access_logs (cpf_digits);

create index if not exists idx_public_boleto_access_logs_action
  on public.public_boleto_access_logs (action);

alter table public.public_boleto_access_logs enable row level security;

drop policy if exists "public_boleto_access_logs_select_auth" on public.public_boleto_access_logs;
create policy "public_boleto_access_logs_select_auth"
  on public.public_boleto_access_logs
  for select
  to authenticated
  using (true);
