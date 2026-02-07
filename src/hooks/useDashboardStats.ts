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
  expectedRevenueCents: number;
  actualRevenueCents: number;
  pendingRevenueCents: number;
  latePayments: number;
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

      // Get billing stats for current month
      const { data: billings, error: billingsError } = await supabase
        .from("billings")
        .select("*")
        .eq("reference_month", currentMonth);

      if (billingsError) throw billingsError;

      const billingsThisMonth = billings?.length || 0;
      const paidBillings = billings?.filter((b) => b.status === "PAID").length || 0;
      const openBillings = billings?.filter((b) => b.status === "OPEN").length || 0;
      const cancelledBillings = billings?.filter((b) => b.status === "CANCELADO").length || 0;
      const reviewBillings = billings?.filter((b) => b.status === "NEEDS_REVIEW").length || 0;

      // Calculate revenues
      const expectedRevenueCents = billings
        ?.filter((b) => b.status !== "CANCELADO")
        .reduce((sum, b) => sum + (b.amount_expected_cents || 0), 0) || 0;

      const actualRevenueCents = billings
        ?.filter((b) => b.status === "PAID")
        .reduce((sum, b) => sum + (b.amount_paid_cents || b.amount_expected_cents || 0), 0) || 0;

      const pendingRevenueCents = billings
        ?.filter((b) => b.status === "OPEN")
        .reduce((sum, b) => sum + (b.amount_expected_cents || 0), 0) || 0;

      // Get late payments (OPEN billings past due date)
      const today = new Date().toISOString().split("T")[0];
      const latePayments = billings?.filter(
        (b) => b.status === "OPEN" && b.due_date && b.due_date < today
      ).length || 0;

      return {
        totalPayers,
        activePayers,
        inactivePayers,
        billingsThisMonth,
        paidBillings,
        openBillings,
        cancelledBillings,
        reviewBillings,
        expectedRevenueCents,
        actualRevenueCents,
        pendingRevenueCents,
        latePayments,
      };
    },
  });
}
