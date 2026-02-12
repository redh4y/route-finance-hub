import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  payers: { total: number; active: number; review: number };
  billings: { total: number; paid: number; open: number; cancelled: number };
  vehicles: { total: number; active: number };
  excursions: { total: number; open: number; published: number };
  leads: { total: number };
  affiliates: { total: number; active: number };
  financialEntries: { revenue: number; expense: number };
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      const [
        { data: payers },
        { data: billings },
        { data: vehicles },
        { data: excursions },
        { data: leads },
        { data: affiliates },
        { data: entries },
      ] = await Promise.all([
        supabase.from("payers").select("id, status, needs_review"),
        supabase.from("billings").select("id, status"),
        supabase.from("vehicles").select("id, active"),
        supabase.from("excursions").select("id, status, public_enabled"),
        supabase.from("public_excursion_leads").select("id"),
        supabase.from("affiliates").select("id, status"),
        supabase.from("financial_entries").select("id, type"),
      ]);

      return {
        payers: {
          total: payers?.length ?? 0,
          active: payers?.filter((p) => p.status === "ATIVO").length ?? 0,
          review: payers?.filter((p) => p.needs_review).length ?? 0,
        },
        billings: {
          total: billings?.length ?? 0,
          paid: billings?.filter((b) => b.status === "PAID").length ?? 0,
          open: billings?.filter((b) => b.status === "OPEN").length ?? 0,
          cancelled: billings?.filter((b) => b.status === "CANCELADO").length ?? 0,
        },
        vehicles: {
          total: vehicles?.length ?? 0,
          active: vehicles?.filter((v) => v.active).length ?? 0,
        },
        excursions: {
          total: excursions?.length ?? 0,
          open: excursions?.filter((e) => e.status === "ABERTA" || e.status === "PUBLICADA").length ?? 0,
          published: excursions?.filter((e) => e.public_enabled).length ?? 0,
        },
        leads: { total: leads?.length ?? 0 },
        affiliates: {
          total: affiliates?.length ?? 0,
          active: affiliates?.filter((a) => a.status === "ATIVO").length ?? 0,
        },
        financialEntries: {
          revenue: entries?.filter((e) => e.type === "RECEITA").length ?? 0,
          expense: entries?.filter((e) => e.type === "DESPESA").length ?? 0,
        },
      };
    },
    staleTime: 30_000,
  });
}
