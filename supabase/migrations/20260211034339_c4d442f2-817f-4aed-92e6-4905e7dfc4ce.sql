
-- Add public sale columns to excursions
ALTER TABLE public.excursions 
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pix_expiration_minutes integer NOT NULL DEFAULT 30;

-- Create affiliates table
CREATE TABLE public.affiliates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  responsible text,
  whatsapp text,
  email text,
  commission_type text NOT NULL DEFAULT 'PERCENTUAL', -- PERCENTUAL or FIXO
  commission_value integer NOT NULL DEFAULT 0, -- cents if FIXO, basis points (e.g. 1000 = 10%) if PERCENTUAL
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates are viewable by all" ON public.affiliates FOR SELECT USING (true);
CREATE POLICY "Affiliates can be inserted by all" ON public.affiliates FOR INSERT WITH CHECK (true);
CREATE POLICY "Affiliates can be updated by all" ON public.affiliates FOR UPDATE USING (true);
CREATE POLICY "Affiliates can be deleted by all" ON public.affiliates FOR DELETE USING (true);

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link affiliates to excursions with optional commission override
CREATE TABLE public.affiliate_excursions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  affiliate_token text NOT NULL UNIQUE,
  commission_type_override text, -- null = use affiliate default
  commission_value_override integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id, excursion_id)
);

ALTER TABLE public.affiliate_excursions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliate excursions viewable by all" ON public.affiliate_excursions FOR SELECT USING (true);
CREATE POLICY "Affiliate excursions insertable by all" ON public.affiliate_excursions FOR INSERT WITH CHECK (true);
CREATE POLICY "Affiliate excursions updatable by all" ON public.affiliate_excursions FOR UPDATE USING (true);
CREATE POLICY "Affiliate excursions deletable by all" ON public.affiliate_excursions FOR DELETE USING (true);

-- Public orders (checkout from public page)
CREATE TABLE public.public_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excursion_id uuid NOT NULL REFERENCES public.excursions(id),
  affiliate_id uuid REFERENCES public.affiliates(id),
  passenger_name text NOT NULL,
  passenger_document text NOT NULL,
  passenger_phone text NOT NULL,
  passenger_email text,
  passenger_address text,
  seat_numbers integer[] NOT NULL DEFAULT '{}',
  seat_ids uuid[] NOT NULL DEFAULT '{}',
  amount_total_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  amount_pending_cents integer NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT 'TOTAL', -- TOTAL or PARCIAL
  pix_code text,
  pix_qr_data text,
  pix_expires_at timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, RESERVADO, VENDIDO, EXPIRADO, CANCELADO
  lock_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public orders viewable by all" ON public.public_orders FOR SELECT USING (true);
CREATE POLICY "Public orders insertable by all" ON public.public_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public orders updatable by all" ON public.public_orders FOR UPDATE USING (true);
CREATE POLICY "Public orders deletable by all" ON public.public_orders FOR DELETE USING (true);

CREATE TRIGGER update_public_orders_updated_at BEFORE UPDATE ON public.public_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Affiliate commissions
CREATE TABLE public.affiliate_commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id),
  order_id uuid NOT NULL REFERENCES public.public_orders(id),
  amount_sold_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, CONFIRMADA, PAGA
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliate commissions viewable by all" ON public.affiliate_commissions FOR SELECT USING (true);
CREATE POLICY "Affiliate commissions insertable by all" ON public.affiliate_commissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Affiliate commissions updatable by all" ON public.affiliate_commissions FOR UPDATE USING (true);
CREATE POLICY "Affiliate commissions deletable by all" ON public.affiliate_commissions FOR DELETE USING (true);

CREATE TRIGGER update_affiliate_commissions_updated_at BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
