-- Create cards table for card management
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'sicredi',
  closing_day INTEGER,
  due_day INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Cards são visíveis para todos" 
ON public.cards 
FOR SELECT 
USING (true);

CREATE POLICY "Cards podem ser inseridos por todos" 
ON public.cards 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Cards podem ser atualizados por todos" 
ON public.cards 
FOR UPDATE 
USING (true);

CREATE POLICY "Cards podem ser deletados por todos" 
ON public.cards 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_cards_updated_at
BEFORE UPDATE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();