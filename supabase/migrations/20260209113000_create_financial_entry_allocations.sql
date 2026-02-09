create table if not exists public.financial_entry_allocations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.financial_entries(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  amount_cents integer not null,
  percent numeric(6,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (amount_cents is not null and percent is null) or
    (amount_cents is null and percent is not null)
  ),
  unique(entry_id, vehicle_id)
);

create index if not exists idx_financial_entry_allocations_entry_id
  on public.financial_entry_allocations(entry_id);

create index if not exists idx_financial_entry_allocations_vehicle_id
  on public.financial_entry_allocations(vehicle_id);

alter table public.financial_entry_allocations enable row level security;

create policy "Financial entry allocations are viewable by all"
on public.financial_entry_allocations
for select
using (true);

create policy "Financial entry allocations can be inserted by all"
on public.financial_entry_allocations
for insert
with check (true);

create policy "Financial entry allocations can be updated by all"
on public.financial_entry_allocations
for update
using (true);

create policy "Financial entry allocations can be deleted by all"
on public.financial_entry_allocations
for delete
using (true);

create trigger update_financial_entry_allocations_updated_at
before update on public.financial_entry_allocations
for each row execute function public.update_updated_at_column();
