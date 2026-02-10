
-- Excursions table
CREATE TABLE public.excursions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  destination text NOT NULL,
  destination_state varchar(2),
  departure_at timestamptz NOT NULL,
  return_at timestamptz,
  boarding_location text,
  vehicle_id uuid REFERENCES public.vehicles(id),
  drivers text[] DEFAULT '{}',
  total_seats integer NOT NULL DEFAULT 40,
  seat_price_cents integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'RASCUNHO',
  cost_center_id uuid REFERENCES public.cost_centers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.excursions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Excursions are viewable by all" ON public.excursions FOR SELECT USING (true);
CREATE POLICY "Excursions can be inserted by all" ON public.excursions FOR INSERT WITH CHECK (true);
CREATE POLICY "Excursions can be updated by all" ON public.excursions FOR UPDATE USING (true);
CREATE POLICY "Excursions can be deleted by all" ON public.excursions FOR DELETE USING (true);

CREATE TRIGGER update_excursions_updated_at BEFORE UPDATE ON public.excursions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Excursion seats
CREATE TABLE public.excursion_seats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  status text NOT NULL DEFAULT 'DISPONIVEL',
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(excursion_id, seat_number)
);

ALTER TABLE public.excursion_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seats are viewable by all" ON public.excursion_seats FOR SELECT USING (true);
CREATE POLICY "Seats can be inserted by all" ON public.excursion_seats FOR INSERT WITH CHECK (true);
CREATE POLICY "Seats can be updated by all" ON public.excursion_seats FOR UPDATE USING (true);
CREATE POLICY "Seats can be deleted by all" ON public.excursion_seats FOR DELETE USING (true);

CREATE TRIGGER update_excursion_seats_updated_at BEFORE UPDATE ON public.excursion_seats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Passengers
CREATE TABLE public.passengers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  document text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers are viewable by all" ON public.passengers FOR SELECT USING (true);
CREATE POLICY "Passengers can be inserted by all" ON public.passengers FOR INSERT WITH CHECK (true);
CREATE POLICY "Passengers can be updated by all" ON public.passengers FOR UPDATE USING (true);
CREATE POLICY "Passengers can be deleted by all" ON public.passengers FOR DELETE USING (true);

CREATE TRIGGER update_passengers_updated_at BEFORE UPDATE ON public.passengers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket sales
CREATE TABLE public.ticket_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.passengers(id),
  seat_ids uuid[] NOT NULL DEFAULT '{}',
  seat_numbers integer[] NOT NULL DEFAULT '{}',
  amount_cents integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'DINHEIRO',
  installments integer NOT NULL DEFAULT 1,
  payment_status text NOT NULL DEFAULT 'PREVISTO',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket sales are viewable by all" ON public.ticket_sales FOR SELECT USING (true);
CREATE POLICY "Ticket sales can be inserted by all" ON public.ticket_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Ticket sales can be updated by all" ON public.ticket_sales FOR UPDATE USING (true);
CREATE POLICY "Ticket sales can be deleted by all" ON public.ticket_sales FOR DELETE USING (true);

CREATE TRIGGER update_ticket_sales_updated_at BEFORE UPDATE ON public.ticket_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
