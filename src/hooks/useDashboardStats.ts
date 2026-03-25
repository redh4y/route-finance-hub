import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentMonthRef, getPreviousMonthRef } from "@/lib/formatters";

interface DashboardStats {
  totalPayers: number;
  activePayers: number;
  inactivePayers: number;
  billingsThisMonth: number;
  paidBillings: number;
  openBillings: number;
  cancelledBillings: number;
  reviewBillings: number;
  pendingBillings: number;        // OPEN + NEEDS_REVIEW
  expectedRevenueCents: number;
  actualRevenueCents: number;
  pendingRevenueCents: number;    // OPEN + NEEDS_REVIEW
  collectionRate: number;         // % de expectedRevenue já recebido
  latePayments: number;
  latePaymentPct: number;         // % de boletos vencidos sobre o total
  currentMonth: string;
}

export function useDashboardStats() {
  const currentMonth = getCurrentMonthRef();
  const previousMonth = getPreviousMonthRef(currentMonth);

  return useQuery({
    queryKey: ["dashboard-stats", currentMonth],
    queryFn: async (): Promise<DashboardStats> => {
      // Get payer stats
      const { data: payers, error: payersError } = await supabase
        .from("payers")
        .select("id, status");

      if (payersError) throw payersError;

      const totalPayers = payers?.length || 0;
      const activePayers = payers?.filter((p) => p.status === "ATIVO").length || 0;
      const inactivePayers = totalPayers - activePayers;

      const activePayerIds = (payers || [])
        .filter((p) => p.status === "ATIVO")
        .map((p) => p.id);

      // Get billing stats for current month — only active payers, excluding cancelled
      const { data: billings, error: billingsError } = await supabase
        .from("billings")
        .select("status, amount_expected_cents, amount_paid_cents, due_date")
        .eq("reference_month", currentMonth)
        .in("payer_id", activePayerIds)
        .neq("status", "CANCELADO");

      if (billingsError) throw billingsError;

      const billingsThisMonth = billings?.length || 0;
      const paidBillings = billings?.filter((b) => b.status === "PAID").length || 0;
      const openBillings = billings?.filter((b) => b.status === "OPEN").length || 0;
      const cancelledBillings = 0; // excluídos da query
      const reviewBillings = billings?.filter((b) => b.status === "NEEDS_REVIEW").length || 0;
      const pendingBillings = openBillings + reviewBillings;

      // Calculate revenues (CANCELADO already excluded by query)
      const expectedRevenueCents = billings
        ?.reduce((sum, b) => sum + (b.amount_expected_cents || 0), 0) || 0;

      const actualRevenueCents = billings
        ?.filter((b) => b.status === "PAID")
        .reduce((sum, b) => sum + (b.amount_paid_cents || b.amount_expected_cents || 0), 0) || 0;

      // Pendente = OPEN + NEEDS_REVIEW (ambos representam receita não confirmada)
      const pendingRevenueCents = billings
        ?.filter((b) => b.status === "OPEN" || b.status === "NEEDS_REVIEW")
        .reduce((sum, b) => sum + (b.amount_expected_cents || 0), 0) || 0;

      const collectionRate = expectedRevenueCents > 0
        ? Math.round((actualRevenueCents / expectedRevenueCents) * 100)
        : 0;

      // Late payments (OPEN billings past due date)
      const today = new Date().toISOString().split("T")[0];
      const latePayments = billings?.filter(
        (b) => b.status === "OPEN" && b.due_date && b.due_date < today
      ).length || 0;

      const latePaymentPct = billingsThisMonth > 0
        ? Math.round((latePayments / billingsThisMonth) * 100)
        : 0;

      return {
        totalPayers,
        activePayers,
        inactivePayers,
        billingsThisMonth,
        paidBillings,
        openBillings,
        cancelledBillings,
        reviewBillings,
        pendingBillings,
        expectedRevenueCents,
        actualRevenueCents,
        pendingRevenueCents,
        collectionRate,
        latePayments,
        latePaymentPct,
        currentMonth,
      };
    },
  });
}
