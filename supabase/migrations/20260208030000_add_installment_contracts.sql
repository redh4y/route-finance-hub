-- Add installment contracts and invoice import fields

create table if not exists public.installment_contracts (
  id text primary key,
  provider text not null,
  card_id text not null,
  card_name text null,
  purchase_date date not null,
  merchant_base text not null,
  installment_total integer not null,
  installment_amount_cents integer not null,
  run_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_entries
  add column if not exists status text null,
  add column if not exists operation_date date null,
  add column if not exists invoice_month text null,
  add column if not exists contract_id text null;

create unique index if not exists financial_entries_expense_id_uniq
  on public.financial_entries (expense_id)
  where expense_id is not null;
