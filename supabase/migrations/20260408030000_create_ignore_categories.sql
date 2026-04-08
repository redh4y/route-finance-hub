create table if not exists public.payer_ignore_categories (
  id         uuid  primary key default gen_random_uuid(),
  name       text  not null unique,
  created_at timestamptz not null default now()
);

alter table public.payer_ignore_categories enable row level security;

create policy "ignore_categories_all" on public.payer_ignore_categories
  for all to authenticated using (true) with check (true);

-- Seed de categorias padrão
insert into public.payer_ignore_categories (name) values
  ('Motorista'),
  ('Coordenador'),
  ('Paga por Pix'),
  ('Funcionário')
on conflict (name) do nothing;

-- Adiciona FK opcional de categoria na ignore list
alter table public.payer_import_ignore_list
  add column if not exists category_id uuid references public.payer_ignore_categories(id) on delete set null;
