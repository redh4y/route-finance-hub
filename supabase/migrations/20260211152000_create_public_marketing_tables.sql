create table if not exists public.public_leads (
  id uuid primary key default gen_random_uuid(),
  source_page text not null default '/site',
  excursion_id uuid references public.excursions(id),
  affiliate_ref text,
  name text not null,
  phone text not null,
  email text,
  interest_type text,
  message text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.public_tracking_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source_page text not null default '/site',
  excursion_id uuid references public.excursions(id),
  public_token text,
  affiliate_ref text,
  metadata jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.public_leads enable row level security;
alter table public.public_tracking_events enable row level security;

create policy "public_leads_select_all"
on public.public_leads
for select using (true);

create policy "public_leads_insert_all"
on public.public_leads
for insert with check (true);

create policy "public_tracking_events_select_all"
on public.public_tracking_events
for select using (true);

create policy "public_tracking_events_insert_all"
on public.public_tracking_events
for insert with check (true);

