
-- Poll templates for WhatsApp enquetes
CREATE TABLE public.poll_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selectable_count integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  kind text NOT NULL DEFAULT 'daily',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.poll_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage poll_templates" ON public.poll_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- WhatsApp groups
CREATE TABLE public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  group_jid text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  route_id uuid REFERENCES public.transport_routes(id),
  instance_id uuid REFERENCES public.whatsapp_providers(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage whatsapp_groups" ON public.whatsapp_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student to group mapping
CREATE TABLE public.whatsapp_group_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, student_id)
);
ALTER TABLE public.whatsapp_group_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage whatsapp_group_students" ON public.whatsapp_group_students FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Polls sent
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_poll_id text,
  instance_id uuid REFERENCES public.whatsapp_providers(id),
  group_id uuid REFERENCES public.whatsapp_groups(id),
  template_id uuid REFERENCES public.poll_templates(id),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  selectable_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz,
  poll_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage polls" ON public.polls FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Poll votes
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  voter_phone text,
  voter_jid text,
  student_id uuid REFERENCES public.students(id),
  selected_option text NOT NULL,
  selected_option_index integer,
  voted_at timestamptz NOT NULL DEFAULT now(),
  vote_status text NOT NULL DEFAULT 'active',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_jid)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage poll_votes" ON public.poll_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Poll vote history
CREATE TABLE public.poll_vote_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_vote_id uuid NOT NULL REFERENCES public.poll_votes(id) ON DELETE CASCADE,
  previous_option text,
  new_option text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);
ALTER TABLE public.poll_vote_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read poll_vote_history" ON public.poll_vote_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert poll_vote_history" ON public.poll_vote_history FOR INSERT TO authenticated WITH CHECK (true);

-- Poll dispatch jobs (scheduling)
CREATE TABLE public.poll_dispatch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id),
  template_id uuid NOT NULL REFERENCES public.poll_templates(id),
  schedule_type text NOT NULL DEFAULT 'manual',
  cron_expression text,
  scheduled_for timestamptz,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.poll_dispatch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage poll_dispatch_jobs" ON public.poll_dispatch_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Integration logs
CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL DEFAULT 'whatsapp',
  level text NOT NULL DEFAULT 'info',
  event_type text NOT NULL,
  reference_id text,
  message text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read integration_logs" ON public.integration_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can insert integration_logs" ON public.integration_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Auth can insert integration_logs" ON public.integration_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for polls and votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- Add phone_e164 column to students if not exists (for matching votes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='phone_e164') THEN
    ALTER TABLE public.students ADD COLUMN phone_e164 text;
  END IF;
END $$;
