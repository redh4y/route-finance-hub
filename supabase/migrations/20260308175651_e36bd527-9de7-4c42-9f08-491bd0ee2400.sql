CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'address_match',
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 0,
  input_hash TEXT,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs" ON public.processing_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own jobs" ON public.processing_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can update jobs" ON public.processing_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);