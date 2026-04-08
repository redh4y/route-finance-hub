create table if not exists public.payer_import_ignore_list (
  id         uuid        primary key default gen_random_uuid(),
  wa_name    text        not null,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.payer_import_ignore_list enable row level security;

create policy "ignore_list_select" on public.payer_import_ignore_list
  for select to authenticated using (true);
create policy "ignore_list_insert" on public.payer_import_ignore_list
  for insert to authenticated with check (true);
create policy "ignore_list_delete" on public.payer_import_ignore_list
  for delete to authenticated using (true);
