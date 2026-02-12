create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[] not null default '{}',
  actor_user_id uuid,
  actor_email text,
  request_path text,
  request_meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);
create index if not exists idx_audit_logs_record_id on public.audit_logs(record_id);
create index if not exists idx_audit_logs_operation on public.audit_logs(operation);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs(actor_user_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Audit logs selectable" on public.audit_logs;
create policy "Audit logs selectable"
  on public.audit_logs
  for select
  using (auth.uid() is not null);

drop policy if exists "Audit logs insertable" on public.audit_logs;
create policy "Audit logs insertable"
  on public.audit_logs
  for insert
  with check (true);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_email text;
  v_request_path text;
  v_record_id text;
  v_changed_fields text[] := '{}';
begin
  begin
    v_actor_user_id := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  exception when others then
    v_actor_user_id := null;
  end;

  v_actor_email := nullif(current_setting('request.jwt.claim.email', true), '');
  v_request_path := nullif(current_setting('app.request_path', true), '');

  if tg_op = 'DELETE' then
    v_record_id := coalesce(to_jsonb(old)->>'id', null);
  else
    v_record_id := coalesce(to_jsonb(new)->>'id', null);
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key), '{}')
      into v_changed_fields
      from (
        select n.key
        from jsonb_each(to_jsonb(new)) n
        left join jsonb_each(to_jsonb(old)) o on o.key = n.key
        where n.value is distinct from o.value
      ) changed;
  end if;

  insert into public.audit_logs (
    table_name,
    record_id,
    operation,
    old_data,
    new_data,
    changed_fields,
    actor_user_id,
    actor_email,
    request_path,
    request_meta
  ) values (
    tg_table_name,
    v_record_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    v_changed_fields,
    v_actor_user_id,
    v_actor_email,
    v_request_path,
    null
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'cards',
    'vehicles',
    'financial_entries',
    'financial_entry_allocations',
    'billings',
    'payers',
    'excursions',
    'excursion_seats',
    'public_orders',
    'passengers',
    'ticket_sales',
    'affiliate_commissions',
    'affiliate_excursions',
    'affiliates',
    'public_excursion_leads'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = v_table
    ) then
      execute format('drop trigger if exists trg_audit_%I on public.%I', v_table, v_table);
      execute format(
        'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
        v_table,
        v_table
      );
    end if;
  end loop;
end $$;
