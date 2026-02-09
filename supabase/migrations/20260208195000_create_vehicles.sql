create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text,
  model text,
  year integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

create policy "Vehicles are viewable by all"
on public.vehicles
for select
using (true);

create policy "Vehicles can be inserted by all"
on public.vehicles
for insert
with check (true);

create policy "Vehicles can be updated by all"
on public.vehicles
for update
using (true);

create policy "Vehicles can be deleted by all"
on public.vehicles
for delete
using (true);

create trigger update_vehicles_updated_at
before update on public.vehicles
for each row
execute function public.update_updated_at_column();
