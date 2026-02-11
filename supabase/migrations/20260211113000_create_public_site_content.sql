create table if not exists public.public_site_content (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text,
  content_json jsonb not null default '{}'::jsonb,
  active_sections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_site_content enable row level security;

create policy "public_site_content_select_all"
on public.public_site_content
for select
using (true);

create policy "public_site_content_insert_all"
on public.public_site_content
for insert
with check (true);

create policy "public_site_content_update_all"
on public.public_site_content
for update
using (true);

create policy "public_site_content_delete_all"
on public.public_site_content
for delete
using (true);

create trigger update_public_site_content_updated_at
before update on public.public_site_content
for each row execute function public.update_updated_at_column();

insert into public.public_site_content (page_key, title, content_json, active_sections)
values (
  'public-excursoes-home',
  'Landing Excursoes',
  '{}'::jsonb,
  '{}'::jsonb
)
on conflict (page_key) do nothing;

