
CREATE OR REPLACE FUNCTION public.get_billings_summary(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expected bigint;
  v_paid bigint;
  v_pending bigint;
BEGIN
  SELECT coalesce(sum(amount_expected_cents), 0)
  INTO v_expected
  FROM billings
  WHERE reference_month = p_month AND status != 'CANCELADO';

  SELECT coalesce(sum(coalesce(amount_paid_cents, amount_expected_cents, 0)), 0)
  INTO v_paid
  FROM billings
  WHERE reference_month = p_month AND status = 'PAID';

  SELECT coalesce(sum(amount_expected_cents), 0)
  INTO v_pending
  FROM billings
  WHERE reference_month = p_month AND status = 'OPEN';

  RETURN jsonb_build_object(
    'expected_revenue', v_expected,
    'paid_revenue', v_paid,
    'pending_revenue', v_pending
  );
END;
$$;
