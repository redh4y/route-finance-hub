
CREATE OR REPLACE FUNCTION public.ensure_today_trips()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_dow integer := EXTRACT(DOW FROM v_today)::integer; -- 0=Sun, 6=Sat
  v_route record;
BEGIN
  -- Only weekdays (Mon=1 to Fri=5)
  IF v_dow = 0 OR v_dow = 6 THEN
    RETURN;
  END IF;

  FOR v_route IN
    SELECT id FROM transport_routes WHERE active = true
  LOOP
    -- Create OUTBOUND trip if missing
    INSERT INTO trips (date, route_id, trip_type, boarding_start_time, boarding_end_time, active)
    SELECT v_today, v_route.id, 'OUTBOUND', '06:00'::time, '07:00'::time, true
    WHERE NOT EXISTS (
      SELECT 1 FROM trips
      WHERE date = v_today AND route_id = v_route.id AND trip_type = 'OUTBOUND'
    );

    -- Create RETURN trip if missing
    INSERT INTO trips (date, route_id, trip_type, boarding_start_time, boarding_end_time, active)
    SELECT v_today, v_route.id, 'RETURN', '17:00'::time, '18:00'::time, true
    WHERE NOT EXISTS (
      SELECT 1 FROM trips
      WHERE date = v_today AND route_id = v_route.id AND trip_type = 'RETURN'
    );
  END LOOP;
END;
$$;
