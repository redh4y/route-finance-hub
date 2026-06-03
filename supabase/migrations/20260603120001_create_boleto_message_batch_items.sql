create table boleto_message_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references boleto_message_batches(id) on delete cascade,
  payer_id text,
  cpf_digits text not null,
  student_name text,
  phone text,
  boleto_url text,
  reference_month text not null,
  message_type text not null,
  status text not null default 'OPENED' check (status in ('OPENED', 'NO_PHONE', 'SKIPPED', 'ERROR')),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

create index on boleto_message_batch_items (reference_month, message_type, cpf_digits);
create index on boleto_message_batch_items (batch_id);

alter table boleto_message_batch_items enable row level security;

create policy "auth select batch items"
  on boleto_message_batch_items for select
  using (auth.role() = 'authenticated');

create policy "auth insert batch items"
  on boleto_message_batch_items for insert
  with check (auth.role() = 'authenticated');
