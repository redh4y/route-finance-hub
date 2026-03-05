-- WhatsApp automation module (Evolution-ready)
create type if not exists public.whatsapp_provider_type as enum ('EVOLUTION');
create type if not exists public.whatsapp_campaign_status as enum ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
create type if not exists public.whatsapp_message_status as enum ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

create table if not exists public.whatsapp_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_type public.whatsapp_provider_type not null default 'EVOLUTION',
  base_url text not null,
  instance_name text not null,
  api_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.whatsapp_providers(id) on delete set null,
  name text not null,
  source text not null default 'overdue',
  status public.whatsapp_campaign_status not null default 'DRAFT',
  total_messages integer not null default 0,
  sent_messages integer not null default 0,
  failed_messages integer not null default 0,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  payer_id text null references public.payers(id) on delete set null,
  phone_e164 text not null,
  body text not null,
  status public.whatsapp_message_status not null default 'PENDING',
  provider_message_id text null,
  attempt_count integer not null default 0,
  last_error text null,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, phone_e164, body)
);

create index if not exists idx_whatsapp_campaigns_status on public.whatsapp_campaigns(status);
create index if not exists idx_whatsapp_messages_campaign_status on public.whatsapp_messages(campaign_id, status);
create index if not exists idx_whatsapp_messages_scheduled_status on public.whatsapp_messages(status, scheduled_at);

-- updated_at triggers
create trigger update_whatsapp_providers_updated_at
before update on public.whatsapp_providers
for each row execute function public.update_updated_at_column();

create trigger update_whatsapp_campaigns_updated_at
before update on public.whatsapp_campaigns
for each row execute function public.update_updated_at_column();

create trigger update_whatsapp_messages_updated_at
before update on public.whatsapp_messages
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.whatsapp_providers enable row level security;
alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists "whatsapp_providers_select_auth" on public.whatsapp_providers;
create policy "whatsapp_providers_select_auth" on public.whatsapp_providers
for select to authenticated using (true);

drop policy if exists "whatsapp_providers_write_auth" on public.whatsapp_providers;
create policy "whatsapp_providers_write_auth" on public.whatsapp_providers
for all to authenticated using (true) with check (true);

drop policy if exists "whatsapp_campaigns_select_auth" on public.whatsapp_campaigns;
create policy "whatsapp_campaigns_select_auth" on public.whatsapp_campaigns
for select to authenticated using (true);

drop policy if exists "whatsapp_campaigns_write_auth" on public.whatsapp_campaigns;
create policy "whatsapp_campaigns_write_auth" on public.whatsapp_campaigns
for all to authenticated using (true) with check (true);

drop policy if exists "whatsapp_messages_select_auth" on public.whatsapp_messages;
create policy "whatsapp_messages_select_auth" on public.whatsapp_messages
for select to authenticated using (true);

drop policy if exists "whatsapp_messages_write_auth" on public.whatsapp_messages;
create policy "whatsapp_messages_write_auth" on public.whatsapp_messages
for all to authenticated using (true) with check (true);

-- audit triggers if audit function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_row_change') THEN
    EXECUTE 'drop trigger if exists trg_audit_whatsapp_providers on public.whatsapp_providers';
    EXECUTE 'create trigger trg_audit_whatsapp_providers after insert or update or delete on public.whatsapp_providers for each row execute function public.audit_row_change()';

    EXECUTE 'drop trigger if exists trg_audit_whatsapp_campaigns on public.whatsapp_campaigns';
    EXECUTE 'create trigger trg_audit_whatsapp_campaigns after insert or update or delete on public.whatsapp_campaigns for each row execute function public.audit_row_change()';

    EXECUTE 'drop trigger if exists trg_audit_whatsapp_messages on public.whatsapp_messages';
    EXECUTE 'create trigger trg_audit_whatsapp_messages after insert or update or delete on public.whatsapp_messages for each row execute function public.audit_row_change()';
  END IF;
END $$;
