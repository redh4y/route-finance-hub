create table boleto_message_batches (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null,
  type text not null check (type in ('emissao', 'link', 'vencimento', 'urgente')),
  total_included integer not null default 0,
  status text not null default 'OPENED' check (status in ('OPENED', 'PARTIAL', 'FINISHED')),
  created_by text,
  created_at timestamptz not null default now()
);

create index on boleto_message_batches (reference_month, type);

alter table boleto_message_batches enable row level security;

create policy "auth select batches"
  on boleto_message_batches for select
  using (auth.role() = 'authenticated');

create policy "auth insert batches"
  on boleto_message_batches for insert
  with check (auth.role() = 'authenticated');
