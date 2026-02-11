import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Affiliate {
  id: string;
  name: string;
  responsible: string | null;
  whatsapp: string | null;
  email: string | null;
  commission_type: string;
  commission_value: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliateExcursion {
  id: string;
  affiliate_id: string;
  excursion_id: string;
  affiliate_token: string;
  commission_type_override: string | null;
  commission_value_override: number | null;
  created_at: string;
  affiliates?: Affiliate | null;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  excursion_id: string;
  order_id: string;
  amount_sold_cents: number;
  commission_cents: number;
  status: string;
  created_at: string;
  affiliates?: Affiliate | null;
}

export function useAffiliates() {
  return useQuery({
    queryKey: ["affiliates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as unknown as Affiliate[];
    },
  });
}

export function useCreateAffiliate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Affiliate, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("affiliates").insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affiliates"] });
      toast.success("Afiliado criado com sucesso");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdateAffiliate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<Affiliate>) => {
      const { error } = await supabase.from("affiliates").update(input as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affiliates"] });
      toast.success("Afiliado atualizado");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteAffiliate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("affiliates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["affiliates"] });
      toast.success("Afiliado removido");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useExcursionAffiliates(excursionId: string | undefined) {
  return useQuery({
    queryKey: ["excursion-affiliates", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_excursions")
        .select("*, affiliates(*)")
        .eq("excursion_id", excursionId!);
      if (error) throw error;
      return data as unknown as AffiliateExcursion[];
    },
  });
}

export function useLinkAffiliate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      affiliate_id: string;
      excursion_id: string;
      commission_type_override?: string;
      commission_value_override?: number;
    }) => {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { error } = await supabase.from("affiliate_excursions").insert({
        affiliate_id: input.affiliate_id,
        excursion_id: input.excursion_id,
        affiliate_token: token,
        commission_type_override: input.commission_type_override || null,
        commission_value_override: input.commission_value_override ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["excursion-affiliates"] });
      toast.success("Afiliado vinculado à excursão");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUnlinkAffiliate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("affiliate_excursions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["excursion-affiliates"] });
      toast.success("Afiliado desvinculado");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useAffiliateCommissions(affiliateId?: string) {
  return useQuery({
    queryKey: ["affiliate-commissions", affiliateId],
    queryFn: async () => {
      let query = supabase
        .from("affiliate_commissions")
        .select("*, affiliates(*)")
        .order("created_at", { ascending: false });
      if (affiliateId) query = query.eq("affiliate_id", affiliateId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AffiliateCommission[];
    },
  });
}

export function usePublicOrders(excursionId?: string) {
  return useQuery({
    queryKey: ["public-orders", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_orders")
        .select("*")
        .eq("excursion_id", excursionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
