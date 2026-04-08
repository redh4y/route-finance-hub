alter table public.payer_import_ignore_list
  add column if not exists source_group_id uuid references public.payer_groups(id) on delete set null;
