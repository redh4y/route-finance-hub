create table if not exists public.dre_groups (
  id uuid primary key default gen_random_uuid(),
  nature text not null check (nature in ('CUSTO','DESPESA','RECEITA','OUTRAS')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(nature, name)
);

create table if not exists public.dre_subgroups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.dre_groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, name)
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'OUTRO' check (type in ('VEICULO','ROTA','ADMIN','OUTRO')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, type)
);

alter table public.financial_entries
  add column if not exists group_id uuid references public.dre_groups(id),
  add column if not exists subgroup_id uuid references public.dre_subgroups(id),
  add column if not exists cost_center_id uuid references public.cost_centers(id);

create index if not exists idx_financial_entries_group_id on public.financial_entries(group_id);
create index if not exists idx_financial_entries_subgroup_id on public.financial_entries(subgroup_id);
create index if not exists idx_financial_entries_cost_center_id on public.financial_entries(cost_center_id);

alter table public.dre_groups enable row level security;
alter table public.dre_subgroups enable row level security;
alter table public.cost_centers enable row level security;

create policy "DRE groups are viewable by all"
on public.dre_groups for select using (true);
create policy "DRE groups can be inserted by all"
on public.dre_groups for insert with check (true);
create policy "DRE groups can be updated by all"
on public.dre_groups for update using (true);
create policy "DRE groups can be deleted by all"
on public.dre_groups for delete using (true);

create policy "DRE subgroups are viewable by all"
on public.dre_subgroups for select using (true);
create policy "DRE subgroups can be inserted by all"
on public.dre_subgroups for insert with check (true);
create policy "DRE subgroups can be updated by all"
on public.dre_subgroups for update using (true);
create policy "DRE subgroups can be deleted by all"
on public.dre_subgroups for delete using (true);

create policy "Cost centers are viewable by all"
on public.cost_centers for select using (true);
create policy "Cost centers can be inserted by all"
on public.cost_centers for insert with check (true);
create policy "Cost centers can be updated by all"
on public.cost_centers for update using (true);
create policy "Cost centers can be deleted by all"
on public.cost_centers for delete using (true);

create trigger update_dre_groups_updated_at
before update on public.dre_groups
for each row execute function public.update_updated_at_column();

create trigger update_dre_subgroups_updated_at
before update on public.dre_subgroups
for each row execute function public.update_updated_at_column();

create trigger update_cost_centers_updated_at
before update on public.cost_centers
for each row execute function public.update_updated_at_column();
