-- Grupos de viagem para controle de membros ativos por WhatsApp group
create table if not exists public.payer_groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  color       text        not null default 'blue',
  description text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- Join: pagador ↔ grupo (com nome original do WhatsApp para auditoria)
create table if not exists public.payer_group_members (
  id              uuid        primary key default gen_random_uuid(),
  group_id        uuid        not null references public.payer_groups(id) on delete cascade,
  payer_id        uuid        not null references public.payers(id) on delete cascade,
  wa_display_name text,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  unique (group_id, payer_id)
);

create index if not exists idx_payer_group_members_group  on public.payer_group_members(group_id);
create index if not exists idx_payer_group_members_payer  on public.payer_group_members(payer_id);

alter table public.payer_groups        enable row level security;
alter table public.payer_group_members enable row level security;

-- payer_groups policies
create policy "payer_groups_select" on public.payer_groups for select to authenticated using (true);
create policy "payer_groups_insert" on public.payer_groups for insert to authenticated with check (true);
create policy "payer_groups_update" on public.payer_groups for update to authenticated using (true) with check (true);
create policy "payer_groups_delete" on public.payer_groups for delete to authenticated using (true);

-- payer_group_members policies
create policy "payer_group_members_select" on public.payer_group_members for select to authenticated using (true);
create policy "payer_group_members_insert" on public.payer_group_members for insert to authenticated with check (true);
create policy "payer_group_members_update" on public.payer_group_members for update to authenticated using (true) with check (true);
create policy "payer_group_members_delete" on public.payer_group_members for delete to authenticated using (true);
