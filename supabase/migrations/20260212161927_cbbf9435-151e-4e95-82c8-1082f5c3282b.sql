
-- =============================================
-- 1. TIGHTEN RLS: financial_entries (auth only)
-- =============================================
DROP POLICY IF EXISTS "Financial entries são visíveis para todos" ON public.financial_entries;
DROP POLICY IF EXISTS "Financial entries podem ser inseridos por todos" ON public.financial_entries;
DROP POLICY IF EXISTS "Financial entries podem ser atualizados por todos" ON public.financial_entries;
DROP POLICY IF EXISTS "Financial entries podem ser deletados por todos" ON public.financial_entries;

CREATE POLICY "financial_entries_select_auth" ON public.financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_entries_insert_auth" ON public.financial_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "financial_entries_update_auth" ON public.financial_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "financial_entries_delete_auth" ON public.financial_entries FOR DELETE TO authenticated USING (true);

-- =============================================
-- 2. TIGHTEN RLS: payers (auth only)
-- =============================================
DROP POLICY IF EXISTS "Payers são visíveis para todos" ON public.payers;
DROP POLICY IF EXISTS "Payers podem ser inseridos por todos" ON public.payers;
DROP POLICY IF EXISTS "Payers podem ser atualizados por todos" ON public.payers;
DROP POLICY IF EXISTS "Payers podem ser deletados por todos" ON public.payers;

CREATE POLICY "payers_select_auth" ON public.payers FOR SELECT TO authenticated USING (true);
CREATE POLICY "payers_insert_auth" ON public.payers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payers_update_auth" ON public.payers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payers_delete_auth" ON public.payers FOR DELETE TO authenticated USING (true);

-- =============================================
-- 3. TIGHTEN RLS: excursions (anon reads public only)
-- =============================================
DROP POLICY IF EXISTS "Excursions are viewable by all" ON public.excursions;
DROP POLICY IF EXISTS "Excursions can be inserted by all" ON public.excursions;
DROP POLICY IF EXISTS "Excursions can be updated by all" ON public.excursions;
DROP POLICY IF EXISTS "Excursions can be deleted by all" ON public.excursions;

CREATE POLICY "excursions_select_anon" ON public.excursions FOR SELECT TO anon USING (public_enabled = true);
CREATE POLICY "excursions_select_auth" ON public.excursions FOR SELECT TO authenticated USING (true);
CREATE POLICY "excursions_insert_auth" ON public.excursions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "excursions_update_auth" ON public.excursions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "excursions_delete_auth" ON public.excursions FOR DELETE TO authenticated USING (true);

-- =============================================
-- 4. TIGHTEN RLS: excursion_seats (anon reads public excursions only)
-- =============================================
DROP POLICY IF EXISTS "Seats are viewable by all" ON public.excursion_seats;
DROP POLICY IF EXISTS "Seats can be inserted by all" ON public.excursion_seats;
DROP POLICY IF EXISTS "Seats can be updated by all" ON public.excursion_seats;
DROP POLICY IF EXISTS "Seats can be deleted by all" ON public.excursion_seats;

CREATE POLICY "seats_select_anon" ON public.excursion_seats FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.excursions WHERE id = excursion_id AND public_enabled = true));
CREATE POLICY "seats_select_auth" ON public.excursion_seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "seats_insert_auth" ON public.excursion_seats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seats_update_auth" ON public.excursion_seats FOR UPDATE TO authenticated USING (true);
CREATE POLICY "seats_delete_auth" ON public.excursion_seats FOR DELETE TO authenticated USING (true);

-- =============================================
-- 5. TIGHTEN RLS: public_orders (no direct anon access, use RPC)
-- =============================================
DROP POLICY IF EXISTS "Public orders viewable by all" ON public.public_orders;
DROP POLICY IF EXISTS "Public orders insertable by all" ON public.public_orders;
DROP POLICY IF EXISTS "Public orders updatable by all" ON public.public_orders;
DROP POLICY IF EXISTS "Public orders deletable by all" ON public.public_orders;

CREATE POLICY "orders_select_auth" ON public.public_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert_auth" ON public.public_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update_auth" ON public.public_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "orders_delete_auth" ON public.public_orders FOR DELETE TO authenticated USING (true);

-- =============================================
-- 6. TIGHTEN RLS: public_excursion_leads (anon insert only)
-- =============================================
DROP POLICY IF EXISTS "Public leads selectable" ON public.public_excursion_leads;
DROP POLICY IF EXISTS "Public leads insertable" ON public.public_excursion_leads;
DROP POLICY IF EXISTS "Public leads updatable" ON public.public_excursion_leads;

CREATE POLICY "leads_select_auth" ON public.public_excursion_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "leads_insert_anon" ON public.public_excursion_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "leads_insert_auth" ON public.public_excursion_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leads_update_auth" ON public.public_excursion_leads FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 7. ATOMIC SEAT RESERVATION (prevents double-selling)
-- =============================================
CREATE OR REPLACE FUNCTION public.reserve_seats(
  p_excursion_token text,
  p_seat_numbers integer[],
  p_passenger_name text,
  p_passenger_document text,
  p_passenger_phone text,
  p_passenger_email text DEFAULT NULL,
  p_passenger_address text DEFAULT NULL,
  p_payment_type text DEFAULT 'TOTAL',
  p_affiliate_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excursion record;
  v_seat record;
  v_seat_ids uuid[] := '{}';
  v_order_id uuid;
  v_total_cents integer;
  v_paid_cents integer;
  v_pending_cents integer;
  v_lock_expires timestamptz;
  v_pix_expires timestamptz;
  v_pix_code text;
  v_sn integer;
BEGIN
  -- Lock excursion row to serialize concurrent checkouts
  SELECT * INTO v_excursion FROM excursions
  WHERE public_token = p_excursion_token AND public_enabled = true AND status IN ('ABERTA', 'PUBLICADA')
  FOR UPDATE;

  IF v_excursion IS NULL THEN
    RETURN jsonb_build_object('error', 'Excursão não encontrada ou não disponível');
  END IF;

  -- Lock and validate each requested seat
  FOREACH v_sn IN ARRAY p_seat_numbers LOOP
    SELECT * INTO v_seat FROM excursion_seats
    WHERE excursion_id = v_excursion.id AND seat_number = v_sn
    FOR UPDATE;

    IF v_seat IS NULL OR v_seat.status != 'DISPONIVEL' OR v_seat.blocked THEN
      RETURN jsonb_build_object('error', format('Assento %s não está disponível', v_sn));
    END IF;

    v_seat_ids := v_seat_ids || v_seat.id;
  END LOOP;

  -- Calculate amounts
  v_total_cents := v_excursion.seat_price_cents * array_length(p_seat_numbers, 1);
  IF p_payment_type = 'PARCIAL' THEN
    v_paid_cents := v_total_cents / 2;
  ELSE
    v_paid_cents := v_total_cents;
  END IF;
  v_pending_cents := v_total_cents - v_paid_cents;

  -- Set lock/PIX expiration
  v_lock_expires := now() + (v_excursion.pix_expiration_minutes || ' minutes')::interval;
  v_pix_expires := v_lock_expires;
  v_pix_code := 'PIX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

  -- Create order atomically
  INSERT INTO public_orders (
    excursion_id, seat_ids, seat_numbers,
    passenger_name, passenger_document, passenger_phone, passenger_email, passenger_address,
    payment_type, amount_total_cents, amount_paid_cents, amount_pending_cents,
    pix_code, pix_expires_at, lock_expires_at, status, affiliate_id
  ) VALUES (
    v_excursion.id, v_seat_ids, p_seat_numbers,
    p_passenger_name, p_passenger_document, p_passenger_phone, p_passenger_email, p_passenger_address,
    p_payment_type, v_total_cents, v_paid_cents, v_pending_cents,
    v_pix_code, v_pix_expires, v_lock_expires, 'PENDENTE', p_affiliate_id
  ) RETURNING id INTO v_order_id;

  -- Mark seats as RESERVADO
  UPDATE excursion_seats SET status = 'RESERVADO', updated_at = now()
  WHERE id = ANY(v_seat_ids);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'pix_code', v_pix_code,
    'pix_expires_at', v_pix_expires,
    'lock_expires_at', v_lock_expires,
    'amount_total_cents', v_total_cents,
    'amount_paid_cents', v_paid_cents,
    'amount_pending_cents', v_pending_cents,
    'seat_numbers', to_jsonb(p_seat_numbers),
    'seat_ids', to_jsonb(v_seat_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_seats TO anon;
GRANT EXECUTE ON FUNCTION public.reserve_seats TO authenticated;

-- =============================================
-- 8. EXPIRED LOCK CLEANUP (releases stuck seats)
-- =============================================
CREATE OR REPLACE FUNCTION public.release_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_order record;
BEGIN
  FOR v_order IN
    SELECT id, seat_ids FROM public_orders
    WHERE status = 'PENDENTE' AND lock_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE excursion_seats SET status = 'DISPONIVEL', updated_at = now()
    WHERE id = ANY(v_order.seat_ids) AND status = 'RESERVADO';

    UPDATE public_orders SET status = 'EXPIRADO', updated_at = now() WHERE id = v_order.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_expired_locks TO anon;
GRANT EXECUTE ON FUNCTION public.release_expired_locks TO authenticated;
