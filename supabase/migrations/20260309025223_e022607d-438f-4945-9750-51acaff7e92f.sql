
-- Add payer_id to students for linking self-registered students to payers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='payer_id') THEN
    ALTER TABLE public.students ADD COLUMN payer_id uuid REFERENCES public.payers(id);
  END IF;
END $$;
