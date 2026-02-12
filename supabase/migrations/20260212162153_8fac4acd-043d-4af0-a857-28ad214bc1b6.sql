
-- Expand reserve_seats to handle all checkout side-effects atomically
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
  v_passenger_id uuid;
  v_seat_status text;
  v_order_status text;
  v_payment_status text;
  v_comp_month text;
  v_aff_link record;
  v_commission_cents integer;
BEGIN
  -- 1. Lock excursion row
  SELECT * INTO v_excursion FROM excursions
  WHERE public_token = p_excursion_token AND public_enabled = true AND status IN ('ABERTA', 'PUBLICADA')
  FOR UPDATE;

  IF v_excursion IS NULL THEN
    RETURN jsonb_build_object('error', 'Excursão não encontrada ou não disponível');
  END IF;

  -- 2. Lock and validate each seat
  FOREACH v_sn IN ARRAY p_seat_numbers LOOP
    SELECT * INTO v_seat FROM excursion_seats
    WHERE excursion_id = v_excursion.id AND seat_number = v_sn
    FOR UPDATE;

    IF v_seat IS NULL OR v_seat.status != 'DISPONIVEL' OR v_seat.blocked THEN
      RETURN jsonb_build_object('error', format('Assento %s não está disponível', v_sn));
    END IF;

    v_seat_ids := v_seat_ids || v_seat.id;
  END LOOP;

  -- 3. Calculate amounts
  v_total_cents := v_excursion.seat_price_cents * array_length(p_seat_numbers, 1);
  IF p_payment_type = 'PARCIAL' THEN
    v_paid_cents := v_total_cents / 2;
  ELSE
    v_paid_cents := v_total_cents;
  END IF;
  v_pending_cents := v_total_cents - v_paid_cents;

  -- 4. Determine statuses
  IF p_payment_type = 'TOTAL' THEN
    v_seat_status := 'VENDIDO';
    v_order_status := 'VENDIDO';
    v_payment_status := 'PAGO';
  ELSE
    v_seat_status := 'RESERVADO';
    v_order_status := 'RESERVADO';
    v_payment_status := 'PREVISTO';
  END IF;

  -- 5. Set expiration
  v_lock_expires := now() + (v_excursion.pix_expiration_minutes || ' minutes')::interval;
  v_pix_expires := v_lock_expires;
  v_pix_code := '00020126580014br.gov.bcb.pix0136' || gen_random_uuid()::text || '5204000053039865802BR5925TAVARES TRANSPORTES6009SAO PAULO62070503***6304';

  -- 6. Create order
  INSERT INTO public_orders (
    excursion_id, seat_ids, seat_numbers,
    passenger_name, passenger_document, passenger_phone, passenger_email, passenger_address,
    payment_type, amount_total_cents, amount_paid_cents, amount_pending_cents,
    pix_code, pix_qr_data, pix_expires_at, lock_expires_at, status, affiliate_id
  ) VALUES (
    v_excursion.id, v_seat_ids, p_seat_numbers,
    p_passenger_name, p_passenger_document, p_passenger_phone, p_passenger_email, p_passenger_address,
    p_payment_type, v_total_cents, v_paid_cents, v_pending_cents,
    v_pix_code, v_pix_code, v_pix_expires, v_lock_expires, v_order_status, p_affiliate_id
  ) RETURNING id INTO v_order_id;

  -- 7. Update seats
  UPDATE excursion_seats SET status = v_seat_status, updated_at = now()
  WHERE id = ANY(v_seat_ids);

  -- 8. Upsert passenger
  SELECT id INTO v_passenger_id FROM passengers WHERE document = p_passenger_document LIMIT 1;
  IF v_passenger_id IS NOT NULL THEN
    UPDATE passengers SET name = p_passenger_name, phone = p_passenger_phone, email = p_passenger_email, updated_at = now()
    WHERE id = v_passenger_id;
  ELSE
    INSERT INTO passengers (name, document, phone, email)
    VALUES (p_passenger_name, p_passenger_document, p_passenger_phone, p_passenger_email)
    RETURNING id INTO v_passenger_id;
  END IF;

  -- 9. Create ticket sale
  INSERT INTO ticket_sales (excursion_id, passenger_id, seat_ids, seat_numbers, amount_cents, payment_method, installments, payment_status)
  VALUES (v_excursion.id, v_passenger_id, v_seat_ids, p_seat_numbers, v_paid_cents, 'PIX', 1, v_payment_status);

  -- 10. Create financial entry
  v_comp_month := to_char(v_excursion.departure_at, 'YYYY-MM');
  INSERT INTO financial_entries (competence_month, date, type, category, description, amount_cents, source)
  VALUES (v_comp_month, CURRENT_DATE, 'RECEITA', 'EXCURSAO',
    'Venda online assento(s) ' || array_to_string(p_seat_numbers, ',') || ' - ' || v_excursion.name,
    v_paid_cents, 'AUTO');

  -- 11. Affiliate commission
  IF p_affiliate_id IS NOT NULL THEN
    SELECT ae.*, a.commission_type, a.commission_value
    INTO v_aff_link
    FROM affiliate_excursions ae
    JOIN affiliates a ON a.id = ae.affiliate_id
    WHERE ae.affiliate_id = p_affiliate_id AND ae.excursion_id = v_excursion.id
    LIMIT 1;

    IF v_aff_link IS NOT NULL THEN
      IF coalesce(v_aff_link.commission_type_override, v_aff_link.commission_type) = 'PERCENTUAL' THEN
        v_commission_cents := (v_paid_cents * coalesce(v_aff_link.commission_value_override, v_aff_link.commission_value)) / 10000;
      ELSE
        v_commission_cents := coalesce(v_aff_link.commission_value_override, v_aff_link.commission_value) * array_length(p_seat_numbers, 1);
      END IF;

      INSERT INTO affiliate_commissions (affiliate_id, excursion_id, order_id, amount_sold_cents, commission_cents, status)
      VALUES (p_affiliate_id, v_excursion.id, v_order_id, v_paid_cents, v_commission_cents,
        CASE WHEN p_payment_type = 'TOTAL' THEN 'CONFIRMADA' ELSE 'PENDENTE' END);
    END IF;
  END IF;

  -- 12. Return
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'pix_code', v_pix_code,
    'pix_expires_at', v_pix_expires,
    'lock_expires_at', v_lock_expires,
    'amount_total_cents', v_total_cents,
    'amount_paid_cents', v_paid_cents,
    'amount_pending_cents', v_pending_cents,
    'seat_numbers', to_jsonb(p_seat_numbers),
    'seat_ids', to_jsonb(v_seat_ids),
    'status', v_order_status
  );
END;
$$;
