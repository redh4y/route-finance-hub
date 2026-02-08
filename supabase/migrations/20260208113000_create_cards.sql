create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null default 'sicredi',
  closing_day integer,
  due_day integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_active_idx on public.cards (active);
