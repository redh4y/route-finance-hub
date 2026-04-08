-- Logs de falhas de importação de grupos (nomes sem match ou ignorados pelo usuário)
create table if not exists public.payer_group_import_logs (
  id                   uuid        primary key default gen_random_uuid(),
  group_id             uuid        not null references public.payer_groups(id) on delete cascade,
  batch_id             uuid        not null,          -- agrupa entradas do mesmo salvamento
  imported_at          timestamptz not null default now(),
  wa_display_name      text        not null,
  status               text        not null,          -- 'unmatched' | 'review_ignored'
  best_candidate_name  text,                          -- nome do melhor payer candidato, se houver
  best_candidate_score smallint                       -- score 0-100
);

alter table public.payer_group_import_logs enable row level security;

create policy "import_logs_select" on public.payer_group_import_logs
  for select to authenticated using (true);

create policy "import_logs_insert" on public.payer_group_import_logs
  for insert to authenticated with check (true);

create policy "import_logs_delete" on public.payer_group_import_logs
  for delete to authenticated using (true);

create index idx_import_logs_group on public.payer_group_import_logs(group_id);
create index idx_import_logs_batch  on public.payer_group_import_logs(batch_id);
