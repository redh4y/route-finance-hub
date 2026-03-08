import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Payer {
  id: string;
  name: string;
  name_lower: string | null;
  document: string | null;
  document_digits: string | null;
  document_valid: boolean | null;
  payer_code: string | null;
  address_original: string | null;
  match_ok: boolean | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
  address_base: string | null;
  review_status: string | null;
  review_reason: string | null;
  review_flag: boolean | null;
  review_address: boolean | null;
  phone: string | null;
  email: string | null;
  status: string;
  billing_mode: string;
  manual_active_until: string | null;
  is_coordinator: boolean | null;
  billing_seen_in_month: string | null;
  last_billing_ref: string | null;
  last_payment_at: string | null;
  needs_review: boolean | null;
  default_route: string | null;
  pix_monthly_amount_cents: number | null;
  pix_due_day: number | null;
  route: string | null;
  extra_contacts: any;
  change_log: any;
  created_at: string;
  updated_at: string;
}

export interface PayersFilters {
  status?: string;
  billingMode?: string;
  route?: string;
  needsReview?: boolean;
  reviewReason?: string;
  documentValid?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PayersResult {
  rows: Payer[];
  count: number;
}

const DEFAULT_PAGE_SIZE = 50;

export function usePayers(filters: PayersFilters = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: ["payers", filters],
    queryFn: async (): Promise<PayersResult> => {
      let query = supabase.from("payers").select("*", { count: "exact" });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.billingMode) {
        query = query.eq("billing_mode", filters.billingMode);
      }
      if (filters.route) {
        query = query.eq("default_route", filters.route);
      }
      if (filters.needsReview !== undefined) {
        query = query.eq("needs_review", filters.needsReview);
      }
      if (filters.reviewReason) {
        query = query.eq("review_reason", filters.reviewReason);
      }
      if (filters.documentValid !== undefined) {
        query = query.eq("document_valid", filters.documentValid);
      }
      if (filters.search) {
        query = query.ilike("name_lower", `%${filters.search.toLowerCase()}%`);
      }

      const { data, error, count } = await query
        .order("name", { ascending: true })
        .range(from, to);

      if (error) throw error;
      return { rows: (data || []) as Payer[], count: count || 0 };
    },
  });
}

/** Separate lightweight query for stats counts */
export function usePayersStats() {
  return useQuery({
    queryKey: ["payers-stats"],
    queryFn: async () => {
      const [
        { count: total },
        { count: active },
        { count: inactive },
        { count: review },
        { count: uncatalogued },
      ] = await Promise.all([
        supabase.from("payers").select("id", { count: "exact", head: true }),
        supabase.from("payers").select("id", { count: "exact", head: true }).eq("status", "ATIVO"),
        supabase.from("payers").select("id", { count: "exact", head: true }).eq("status", "INATIVO"),
        supabase.from("payers").select("id", { count: "exact", head: true }).eq("needs_review", true),
        supabase.from("payers").select("id", { count: "exact", head: true }).eq("review_reason", "IMPORT_BILLING_SEM_CADASTRO"),
      ]);

      return {
        total: total || 0,
        active: active || 0,
        inactive: inactive || 0,
        review: review || 0,
        uncatalogued: uncatalogued || 0,
      };
    },
  });
}

export function usePayerById(id: string) {
  return useQuery({
    queryKey: ["payer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Payer | null;
    },
    enabled: !!id,
  });
}

export function useUpdatePayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Payer>;
    }) => {
      const { data, error } = await supabase
        .from("payers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      queryClient.invalidateQueries({ queryKey: ["payers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payer", data.id] });
      toast.success("Pagador atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar pagador: " + error.message);
    },
  });
}

export function useTogglePayerStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "ATIVO" ? "INATIVO" : "ATIVO";
      const { data, error } = await supabase
        .from("payers")
        .update({ status: newStatus })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      queryClient.invalidateQueries({ queryKey: ["payers-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payer", data.id] });
      toast.success(
        data.status === "ATIVO" ? "Pagador ativado" : "Pagador inativado"
      );
    },
    onError: (error) => {
      toast.error("Erro ao alterar status: " + error.message);
    },
  });
}
