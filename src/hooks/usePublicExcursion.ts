import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function usePublicExcursionByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["public-excursion", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*, vehicles(name)")
        .eq("public_token", token!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

export function usePublicSeats(excursionId: string | undefined) {
  return useQuery({
    queryKey: ["public-seats", excursionId],
    enabled: !!excursionId,
    refetchInterval: 5000, // poll for seat updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursion_seats")
        .select("id, seat_number, status, blocked")
        .eq("excursion_id", excursionId!)
        .order("seat_number");
      if (error) throw error;
      return data as { id: string; seat_number: number; status: string; blocked: boolean }[];
    },
  });
}

export function useCreatePublicOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      excursion_token: string;
      affiliate_id?: string;
      passenger_name: string;
      passenger_document: string;
      passenger_phone: string;
      passenger_email?: string;
      passenger_address?: string;
      seat_numbers: number[];
      payment_type: "TOTAL" | "PARCIAL";
    }) => {
      const { data, error } = await supabase.rpc("reserve_seats", {
        p_excursion_token: input.excursion_token,
        p_seat_numbers: input.seat_numbers,
        p_passenger_name: input.passenger_name,
        p_passenger_document: input.passenger_document,
        p_passenger_phone: input.passenger_phone,
        p_passenger_email: input.passenger_email || null,
        p_passenger_address: input.passenger_address || null,
        p_payment_type: input.payment_type,
        p_affiliate_id: input.affiliate_id || null,
      });

      if (error) throw error;

      // The RPC returns jsonb - check for error field
      const result = data as any;
      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-seats"] });
      qc.invalidateQueries({ queryKey: ["public-orders"] });
      toast.success("Pedido realizado com sucesso!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useCapturePublicLead() {
  return useMutation({
    mutationFn: async (input: {
      excursion_id: string;
      public_token: string;
      affiliate_id?: string | null;
      ref_code?: string | null;
      source?: string;
      name: string;
      cpf: string;
      phone: string;
      email?: string;
      address?: string;
      session_id?: string;
      user_agent?: string;
      ip_hash?: string;
    }) => {
      const sb = supabase as any;
      const cpfDigits = (input.cpf || "").replace(/\D/g, "").slice(0, 11);
      const phoneDigits = (input.phone || "").replace(/\D/g, "").slice(0, 11);

      const payload = {
        excursion_id: input.excursion_id,
        affiliate_id: input.affiliate_id || null,
        source: input.source || "public_excursoes",
        ref_code: input.ref_code || null,
        public_token: input.public_token,
        name: input.name.trim(),
        cpf_digits: cpfDigits,
        phone_digits: phoneDigits,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        session_id: input.session_id || null,
        user_agent: input.user_agent || null,
        ip_hash: input.ip_hash || null,
        status: "CAPTURADO",
        last_step_at: new Date().toISOString(),
      };

      const { data, error } = await sb
        .from("public_excursion_leads")
        .upsert(payload, { onConflict: "excursion_id,cpf_digits,phone_digits" })
        .select("id")
        .single();

      if (error) throw error;
      return data as { id: string };
    },
  });
}

export function useUpdatePublicLeadStage() {
  return useMutation({
    mutationFn: async (input: {
      lead_id: string;
      status:
        | "CAPTURADO"
        | "INTERESSE_ASSENTOS"
        | "PIX_GERADO"
        | "RESERVADO"
        | "CONVERTIDO"
        | "ABANDONADO";
      seat_count?: number;
      amount_total_cents?: number;
      payment_type?: "TOTAL" | "PARCIAL";
      order_id?: string | null;
    }) => {
      const sb = supabase as any;
      const { data: current, error: currentError } = await sb
        .from("public_excursion_leads")
        .select("status_history")
        .eq("id", input.lead_id)
        .single();
      if (currentError) throw currentError;

      const statusHistory = Array.isArray(current?.status_history)
        ? current.status_history
        : [];
      statusHistory.push({ status: input.status, at: new Date().toISOString() });

      const updatePayload: Record<string, any> = {
        status: input.status,
        last_step_at: new Date().toISOString(),
        status_history: statusHistory,
      };
      if (typeof input.seat_count === "number") updatePayload.seat_count = input.seat_count;
      if (typeof input.amount_total_cents === "number") updatePayload.amount_total_cents = input.amount_total_cents;
      if (input.payment_type) updatePayload.payment_type = input.payment_type;
      if (input.order_id !== undefined) updatePayload.order_id = input.order_id;

      const { error } = await sb
        .from("public_excursion_leads")
        .update(updatePayload)
        .eq("id", input.lead_id);
      if (error) throw error;
    },
  });
}
