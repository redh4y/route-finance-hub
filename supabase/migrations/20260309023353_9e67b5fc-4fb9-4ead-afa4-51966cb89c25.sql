
-- Students table for attendance module
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  registration text NOT NULL UNIQUE,
  course text,
  active boolean NOT NULL DEFAULT true,
  default_route_id uuid,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transport buses (separate from existing vehicles to avoid coupling)
CREATE TABLE public.transport_buses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  plate text,
  identifier_code text NOT NULL UNIQUE,
  qr_code_value text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  active boolean NOT NULL DEFAULT true,
  vehicle_id uuid REFERENCES public.vehicles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transport routes with boarding location
CREATE TABLE public.transport_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  boarding_location_name text,
  boarding_latitude double precision,
  boarding_longitude double precision,
  radius_meters integer NOT NULL DEFAULT 50,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK for students default route
ALTER TABLE public.students ADD CONSTRAINT students_default_route_id_fkey
  FOREIGN KEY (default_route_id) REFERENCES public.transport_routes(id);

-- Trips (daily scheduled trips)
CREATE TABLE public.trips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  trip_type text NOT NULL CHECK (trip_type IN ('OUTBOUND', 'RETURN')),
  route_id uuid NOT NULL REFERENCES public.transport_routes(id),
  boarding_start_time time NOT NULL,
  boarding_end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, trip_type, route_id)
);

-- Bus assignments per trip
CREATE TABLE public.bus_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, bus_id)
);

-- Attendance records
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id),
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  date date NOT NULL,
  trip_type text NOT NULL CHECK (trip_type IN ('OUTBOUND', 'RETURN')),
  check_in_time timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL CHECK (method IN ('gps', 'qr', 'manual_assisted')),
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'blocked', 'cancelled', 'sync_pending', 'sync_failed')),
  evidence jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, date, trip_type)
);

-- Attendance events for audit
CREATE TABLE public.attendance_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Attendance settings
CREATE TABLE public.attendance_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.attendance_settings (key, value) VALUES
  ('default_radius_meters', '50'),
  ('outbound_start_time', '"06:00"'),
  ('outbound_end_time', '"08:00"'),
  ('return_start_time', '"17:00"'),
  ('return_end_time', '"19:00"'),
  ('fallback_policy', '"qr_on_gps_fail"'),
  ('manual_assisted_enabled', 'true');

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin (authenticated) full access
CREATE POLICY students_select_auth ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY students_insert_auth ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY students_update_auth ON public.students FOR UPDATE TO authenticated USING (true);
CREATE POLICY students_delete_auth ON public.students FOR DELETE TO authenticated USING (true);

CREATE POLICY transport_buses_select_auth ON public.transport_buses FOR SELECT TO authenticated USING (true);
CREATE POLICY transport_buses_insert_auth ON public.transport_buses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY transport_buses_update_auth ON public.transport_buses FOR UPDATE TO authenticated USING (true);
CREATE POLICY transport_buses_delete_auth ON public.transport_buses FOR DELETE TO authenticated USING (true);

CREATE POLICY transport_routes_select_auth ON public.transport_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY transport_routes_insert_auth ON public.transport_routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY transport_routes_update_auth ON public.transport_routes FOR UPDATE TO authenticated USING (true);
CREATE POLICY transport_routes_delete_auth ON public.transport_routes FOR DELETE TO authenticated USING (true);

CREATE POLICY trips_select_auth ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY trips_insert_auth ON public.trips FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY trips_update_auth ON public.trips FOR UPDATE TO authenticated USING (true);
CREATE POLICY trips_delete_auth ON public.trips FOR DELETE TO authenticated USING (true);

CREATE POLICY bus_assignments_select_auth ON public.bus_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY bus_assignments_insert_auth ON public.bus_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY bus_assignments_update_auth ON public.bus_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY bus_assignments_delete_auth ON public.bus_assignments FOR DELETE TO authenticated USING (true);

CREATE POLICY attendance_select_auth ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_insert_auth ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY attendance_update_auth ON public.attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY attendance_delete_auth ON public.attendance FOR DELETE TO authenticated USING (true);

CREATE POLICY attendance_events_select_auth ON public.attendance_events FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_events_insert_auth ON public.attendance_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY attendance_settings_select_auth ON public.attendance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_settings_update_auth ON public.attendance_settings FOR UPDATE TO authenticated USING (true);

-- Anon read for buses/routes (needed for student QR scanning without full admin auth)
CREATE POLICY transport_buses_select_anon ON public.transport_buses FOR SELECT TO anon USING (active = true);
CREATE POLICY transport_routes_select_anon ON public.transport_routes FOR SELECT TO anon USING (active = true);
CREATE POLICY trips_select_anon ON public.trips FOR SELECT TO anon USING (active = true);
CREATE POLICY bus_assignments_select_anon ON public.bus_assignments FOR SELECT TO anon USING (active = true);

-- Anon insert for attendance (student check-in without admin auth)
CREATE POLICY attendance_insert_anon ON public.attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY attendance_select_anon ON public.attendance FOR SELECT TO anon USING (true);

-- Updated_at triggers
CREATE TRIGGER set_updated_at_students BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_transport_buses BEFORE UPDATE ON public.transport_buses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_transport_routes BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_trips BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_attendance BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime for attendance
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
