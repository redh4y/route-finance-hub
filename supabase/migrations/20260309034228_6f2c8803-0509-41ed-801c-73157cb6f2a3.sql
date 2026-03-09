-- Update ensure_today_trips to read default times from attendance_settings
CREATE OR REPLACE FUNCTION public.ensure_today_trips()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_dow integer := EXTRACT(DOW FROM v_today)::integer;
  v_route record;
  v_settings jsonb;
  v_out_start time := '06:00'::time;
  v_out_end time := '07:00'::time;
  v_ret_start time := '17:00'::time;
  v_ret_end time := '18:00'::time;
BEGIN
  IF v_dow = 0 OR v_dow = 6 THEN
    RETURN;
  END IF;

  SELECT value INTO v_settings
  FROM attendance_settings
  WHERE key = 'default_trip_times';

  IF v_settings IS NOT NULL THEN
    v_out_start := coalesce((v_settings->>'outbound_start')::time, '06:00'::time);
    v_out_end   := coalesce((v_settings->>'outbound_end')::time, '07:00'::time);
    v_ret_start := coalesce((v_settings->>'return_start')::time, '17:00'::time);
    v_ret_end   := coalesce((v_settings->>'return_end')::time, '18:00'::time);
  END IF;

  FOR v_route IN
    SELECT id FROM transport_routes WHERE active = true
  LOOP
    INSERT INTO trips (date, route_id, trip_type, boarding_start_time, boarding_end_time, active)
    SELECT v_today, v_route.id, 'OUTBOUND', v_out_start, v_out_end, true
    WHERE NOT EXISTS (
      SELECT 1 FROM trips
      WHERE date = v_today AND route_id = v_route.id AND trip_type = 'OUTBOUND'
    );

    INSERT INTO trips (date, route_id, trip_type, boarding_start_time, boarding_end_time, active)
    SELECT v_today, v_route.id, 'RETURN', v_ret_start, v_ret_end, true
    WHERE NOT EXISTS (
      SELECT 1 FROM trips
      WHERE date = v_today AND route_id = v_route.id AND trip_type = 'RETURN'
    );
  END LOOP;
END;
$$;

-- Allow INSERT on attendance_settings for authenticated users
CREATE POLICY "attendance_settings_insert_auth"
ON public.attendance_settings
FOR INSERT
TO authenticated
WITH CHECK (true);