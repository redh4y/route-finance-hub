import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface FinancialKPIs {
  revenueCents: number;
  costsCents: number;
  expensesCents: number;
  resultCents: number;
}

export interface BillingKPIs {
  openCount: number;
  openValueCents: number;
  overdueCount: number;
  overdueValueCents: number;
  paidCount: number;
  paidValueCents: number;
  cancelledCount: number;
  cancelledValueCents: number;
  reviewCount: number;
  reviewValueCents: number;
  // totais derivados
  totalCount: number;
  expectedRevenueCents: number; // soma de amount_expected_cents de todos (paid+open+review)
  collectionRate: number;       // % paidValueCents / expectedRevenueCents
}

export interface DailyFlow {
  date: string;
  revenueCents: number;
  outflowCents: number;
}

export interface DreGroup {
  name: string;
  totalCents: number;
}

export interface OperationStats {
  activePayers: number;
  inactivePayers: number;
  reviewPayers: number;
  totalPayers: number;
}

export interface CommercialStats {
  activeExcursions: number;
  reservedSeats: number;
  soldSeats: number;
  leadsCount: number;
}

export interface SmartAlert {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
}

function getDefaultRange(): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export { getDefaultRange };

export function useEnhancedDashboard(range: DateRange) {
  const financialQuery = useQuery({
    queryKey: ["enhanced-dash-financial", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("type, amount_cents, date, group_id, category")
        .gte("date", range.startDate)
        .lte("date", range.endDate);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const dreGroupsQuery = useQuery({
    queryKey: ["enhanced-dash-dre-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dre_groups").select("id, name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const billingsQuery = useQuery({
    queryKey: ["enhanced-dash-billings", range],
    queryFn: async () => {
      // Filtrar pelo período (reference_month), excluir CANCELADO
      const startMonth = range.startDate.slice(0, 7); // "YYYY-MM"
      const endMonth = range.endDate.slice(0, 7);
      const { data, error } = await supabase
        .from("billings")
        .select("payer_id, status, due_date, amount_expected_cents, amount_paid_cents")
        .gte("reference_month", startMonth)
        .lte("reference_month", endMonth)
        .neq("status", "CANCELADO");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const payersQuery = useQuery({
    queryKey: ["enhanced-dash-payers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payers")
        .select("id, status, needs_review");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const excursionsQuery = useQuery({
    queryKey: ["enhanced-dash-excursions", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("id, status, departure_at, total_seats")
        .in("status", ["ABERTA", "PUBLICADA"]);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const seatsQuery = useQuery({
    queryKey: ["enhanced-dash-seats", range],
    queryFn: async () => {
      const excursions = excursionsQuery.data;
      if (!excursions?.length) return [];
      const ids = excursions.map((e) => e.id);
      const { data, error } = await supabase
        .from("excursion_seats")
        .select("status, excursion_id")
        .in("excursion_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: !!excursionsQuery.data?.length,
    staleTime: 30_000,
  });

  const leadsQuery = useQuery({
    queryKey: ["enhanced-dash-leads", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_excursion_leads")
        .select("id")
        .gte("created_at", range.startDate)
        .lte("created_at", range.endDate + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const financialKPIs = useMemo<FinancialKPIs>(() => {
    const entries = financialQuery.data || [];
    const revenueCents = entries.filter((e) => e.type === "RECEITA").reduce((s, e) => s + e.amount_cents, 0);
    const costsCents = entries.filter((e) => e.type === "CUSTO").reduce((s, e) => s + e.amount_cents, 0);
    const expensesCents = entries.filter((e) => e.type === "DESPESA").reduce((s, e) => s + e.amount_cents, 0);
    return { revenueCents, costsCents, expensesCents, resultCents: revenueCents - costsCents - expensesCents };
  }, [financialQuery.data]);

  const billingKPIs = useMemo<BillingKPIs>(() => {
    const allBills = billingsQuery.data || [];
    // Filtrar apenas pagadores ATIVOS (CANCELADO já excluído na query)
    const activePayers = payersQuery.data || [];
    const activeIds = new Set(activePayers.filter((p) => p.status === "ATIVO").map((p) => p.id));
    const bills = allBills.filter((b) => b.payer_id && activeIds.has(b.payer_id));
    const today = new Date().toISOString().split("T")[0];
    const open = bills.filter((b) => b.status === "OPEN");
    const overdue = open.filter((b) => b.due_date && b.due_date < today);
    const paid = bills.filter((b) => b.status === "PAID");
    const cancelled: typeof bills = []; // excluídos na query
    const review = bills.filter((b) => b.status === "NEEDS_REVIEW");
    const sumExpected = (arr: typeof bills) => arr.reduce((s, b) => s + (b.amount_expected_cents || 0), 0);
    const sumPaid = (arr: typeof bills) => arr.reduce((s, b) => s + (b.amount_paid_cents || b.amount_expected_cents || 0), 0);
    const totalCount = paid.length + open.length + review.length;
    const expectedRevenueCents = sumExpected(paid) + sumExpected(open) + sumExpected(review);
    const paidValueCents = sumPaid(paid);
    const collectionRate = expectedRevenueCents > 0
      ? Math.round((paidValueCents / expectedRevenueCents) * 100) : 0;
    return {
      openCount: open.length, openValueCents: sumExpected(open),
      overdueCount: overdue.length, overdueValueCents: sumExpected(overdue),
      paidCount: paid.length, paidValueCents,
      cancelledCount: cancelled.length, cancelledValueCents: sumExpected(cancelled),
      reviewCount: review.length, reviewValueCents: sumExpected(review),
      totalCount, expectedRevenueCents, collectionRate,
    };
  }, [billingsQuery.data, payersQuery.data]);

  const dailyFlow = useMemo<DailyFlow[]>(() => {
    const entries = financialQuery.data || [];
    const map = new Map<string, { rev: number; out: number }>();
    entries.forEach((e) => {
      const day = e.date;
      const curr = map.get(day) || { rev: 0, out: 0 };
      if (e.type === "RECEITA") curr.rev += e.amount_cents;
      else curr.out += e.amount_cents;
      map.set(day, curr);
    });
    return Array.from(map.entries())
      .map(([date, v]) => ({ date, revenueCents: v.rev, outflowCents: v.out }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [financialQuery.data]);

  const dreDistribution = useMemo<DreGroup[]>(() => {
    const entries = (financialQuery.data || []).filter((e) => e.type === "CUSTO" || e.type === "DESPESA");
    const groups = dreGroupsQuery.data || [];
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));
    const totals = new Map<string, number>();
    entries.forEach((e) => {
      const name = (e.group_id && groupMap.get(e.group_id)) || e.category || "Outros";
      totals.set(name, (totals.get(name) || 0) + e.amount_cents);
    });
    return Array.from(totals.entries())
      .map(([name, totalCents]) => ({ name, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [financialQuery.data, dreGroupsQuery.data]);

  const operationStats = useMemo<OperationStats>(() => {
    const payers = payersQuery.data || [];
    return {
      totalPayers: payers.length,
      activePayers: payers.filter((p) => p.status === "ATIVO").length,
      inactivePayers: payers.filter((p) => p.status !== "ATIVO").length,
      reviewPayers: payers.filter((p) => p.needs_review).length,
    };
  }, [payersQuery.data]);

  const commercialStats = useMemo<CommercialStats>(() => {
    const seats = seatsQuery.data || [];
    return {
      activeExcursions: excursionsQuery.data?.length || 0,
      reservedSeats: seats.filter((s) => s.status === "RESERVADO").length,
      soldSeats: seats.filter((s) => s.status === "VENDIDO").length,
      leadsCount: leadsQuery.data?.length || 0,
    };
  }, [excursionsQuery.data, seatsQuery.data, leadsQuery.data]);

  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    if (billingKPIs.overdueCount > 0) {
      alerts.push({ id: "overdue", type: "error", message: `${billingKPIs.overdueCount} boleto(s) vencido(s) totalizando ${formatBRL(billingKPIs.overdueValueCents)}` });
    }
    if (financialKPIs.revenueCents > 0) {
      const costRatio = ((financialKPIs.costsCents + financialKPIs.expensesCents) / financialKPIs.revenueCents) * 100;
      if (costRatio > 80) {
        alerts.push({ id: "high-cost", type: "warning", message: `Saídas representam ${costRatio.toFixed(0)}% da receita no período` });
      }
    }
    if (operationStats.reviewPayers > 5) {
      alerts.push({ id: "review-payers", type: "warning", message: `${operationStats.reviewPayers} pagadores aguardando revisão` });
    }
    if (financialKPIs.resultCents < 0) {
      alerts.push({ id: "negative-result", type: "error", message: `Resultado negativo no período: ${formatBRL(financialKPIs.resultCents)}` });
    }
    return alerts.slice(0, 5);
  }, [billingKPIs, financialKPIs, operationStats]);

  const isLoading = financialQuery.isLoading || billingsQuery.isLoading || payersQuery.isLoading || excursionsQuery.isLoading || leadsQuery.isLoading;
  const hasError = financialQuery.error || billingsQuery.error || payersQuery.error || excursionsQuery.error;

  return {
    financialKPIs,
    billingKPIs,
    dailyFlow,
    dreDistribution,
    operationStats,
    commercialStats,
    smartAlerts,
    isLoading,
    hasError,
  };
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
