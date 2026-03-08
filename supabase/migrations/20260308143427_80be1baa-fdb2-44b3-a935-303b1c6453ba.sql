
CREATE OR REPLACE FUNCTION public.get_dre_summary(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_receitas bigint;
  v_custos bigint;
  v_despesas bigint;
  v_outras bigint;
  v_billing_revenue bigint;
BEGIN
  SELECT
    coalesce(sum(CASE WHEN type = 'RECEITA' THEN amount_cents ELSE 0 END), 0),
    coalesce(sum(CASE WHEN type = 'CUSTO' THEN amount_cents ELSE 0 END), 0),
    coalesce(sum(CASE WHEN type = 'DESPESA' THEN amount_cents ELSE 0 END), 0),
    coalesce(sum(CASE WHEN type = 'OUTRAS' THEN amount_cents ELSE 0 END), 0)
  INTO v_receitas, v_custos, v_despesas, v_outras
  FROM financial_entries
  WHERE competence_month = p_month;

  SELECT coalesce(sum(coalesce(amount_paid_cents, amount_expected_cents, 0)), 0)
  INTO v_billing_revenue
  FROM billings
  WHERE reference_month = p_month AND status = 'PAID';

  RETURN jsonb_build_object(
    'receitas', v_receitas,
    'custos', v_custos,
    'despesas', v_despesas,
    'outras', v_outras,
    'billing_revenue', v_billing_revenue
  );
END;
$$;
