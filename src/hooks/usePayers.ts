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
  search?: string;
}

export function usePayers(filters: PayersFilters = {}) {
  return useQuery({
    queryKey: ["payers", filters],
    queryFn: async () => {
      let query = supabase.from("payers").select("*");

      // Apply filters
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
      if (filters.search) {
        query = query.ilike("name_lower", `%${filters.search.toLowerCase()}%`);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      return data as Payer[];
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
