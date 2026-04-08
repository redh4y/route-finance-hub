-- Configuração de valor mensal por rota
create table if not exists public.route_config (
  route               text primary key check (route in ('BARRETOS', 'FRANCA')),
  monthly_amount_cents integer,
  updated_at          timestamptz not null default now()
);

alter table public.route_config enable row level security;

create policy "route_config_select" on public.route_config for select to authenticated using (true);
create policy "route_config_insert" on public.route_config for insert to authenticated with check (true);
create policy "route_config_update" on public.route_config for update to authenticated using (true) with check (true);

-- Seed rows so they always exist
insert into public.route_config (route) values ('BARRETOS'), ('FRANCA')
  on conflict (route) do nothing;
