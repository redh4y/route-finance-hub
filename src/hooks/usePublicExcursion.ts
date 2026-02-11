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
      excursion_id: string;
      affiliate_id?: string;
      passenger_name: string;
      passenger_document: string;
      passenger_phone: string;
      passenger_email?: string;
      passenger_address?: string;
      seat_numbers: number[];
      amount_total_cents: number;
      payment_type: "TOTAL" | "PARCIAL";
      pix_expiration_minutes: number;
    }) => {
      // Get seat IDs
      const { data: seatRows } = await supabase
        .from("excursion_seats")
        .select("id, seat_number, status, blocked")
        .eq("excursion_id", input.excursion_id)
        .in("seat_number", input.seat_numbers);

      // Verify all seats are available
      const unavailable = (seatRows || []).filter(
        (s) => s.status !== "DISPONIVEL" || s.blocked
      );
      if (unavailable.length > 0) {
        throw new Error(
          `Assento(s) ${unavailable.map((s) => s.seat_number).join(", ")} não disponível(eis)`
        );
      }

      const seatIds = (seatRows || []).map((s) => s.id);
      const amountPaid =
        input.payment_type === "TOTAL"
          ? input.amount_total_cents
          : Math.round(input.amount_total_cents * 0.5);
      const amountPending = input.amount_total_cents - amountPaid;
      const pixExpiresAt = new Date(
        Date.now() + input.pix_expiration_minutes * 60 * 1000
      ).toISOString();

      // Lock seats
      const newStatus = input.payment_type === "TOTAL" ? "VENDIDO" : "RESERVADO";
      for (const sn of input.seat_numbers) {
        await supabase
          .from("excursion_seats")
          .update({ status: newStatus })
          .eq("excursion_id", input.excursion_id)
          .eq("seat_number", sn)
          .eq("status", "DISPONIVEL");
      }

      // Simulated PIX code
      const pixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865802BR5925TAVARES TRANSPORTES6009SAO PAULO62070503***6304`;

      // Create order
      const { data: order, error } = await supabase
        .from("public_orders")
        .insert({
          excursion_id: input.excursion_id,
          affiliate_id: input.affiliate_id || null,
          passenger_name: input.passenger_name,
          passenger_document: input.passenger_document,
          passenger_phone: input.passenger_phone,
          passenger_email: input.passenger_email || null,
          passenger_address: input.passenger_address || null,
          seat_numbers: input.seat_numbers,
          seat_ids: seatIds,
          amount_total_cents: input.amount_total_cents,
          amount_paid_cents: amountPaid,
          amount_pending_cents: amountPending,
          payment_type: input.payment_type,
          pix_code: pixCode,
          pix_qr_data: pixCode,
          pix_expires_at: pixExpiresAt,
          status: input.payment_type === "TOTAL" ? "VENDIDO" : "RESERVADO",
          lock_expires_at: pixExpiresAt,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Upsert passenger
      const { data: existingPassenger } = await supabase
        .from("passengers")
        .select("id")
        .eq("document", input.passenger_document)
        .maybeSingle();

      let passengerId: string;
      if (existingPassenger) {
        passengerId = existingPassenger.id;
        await supabase.from("passengers").update({
          name: input.passenger_name,
          phone: input.passenger_phone,
          email: input.passenger_email || null,
        }).eq("id", passengerId);
      } else {
        const { data: newP, error: pErr } = await supabase
          .from("passengers")
          .insert({
            name: input.passenger_name,
            document: input.passenger_document,
            phone: input.passenger_phone,
            email: input.passenger_email || null,
          })
          .select("id")
          .single();
        if (pErr) throw pErr;
        passengerId = newP.id;
      }

      // Create ticket sale
      await supabase.from("ticket_sales").insert({
        excursion_id: input.excursion_id,
        passenger_id: passengerId,
        seat_ids: seatIds,
        seat_numbers: input.seat_numbers,
        amount_cents: amountPaid,
        payment_method: "PIX",
        installments: 1,
        payment_status: input.payment_type === "TOTAL" ? "PAGO" : "PREVISTO",
      });

      // Create financial entry
      const { data: exc } = await supabase
        .from("excursions")
        .select("name, departure_at")
        .eq("id", input.excursion_id)
        .single();

      const depDate = exc?.departure_at ? new Date(exc.departure_at) : new Date();
      const compMonth = `${depDate.getFullYear()}-${String(depDate.getMonth() + 1).padStart(2, "0")}`;

      await supabase.from("financial_entries").insert({
        competence_month: compMonth,
        date: new Date().toISOString().split("T")[0],
        type: "RECEITA",
        category: "EXCURSAO",
        description: `Venda online assento(s) ${input.seat_numbers.join(",")} - ${exc?.name || "Excursão"}`,
        amount_cents: amountPaid,
        source: "AUTO",
      });

      // Create affiliate commission if applicable
      if (input.affiliate_id && order) {
        const { data: affLink } = await supabase
          .from("affiliate_excursions")
          .select("*, affiliates(*)")
          .eq("affiliate_id", input.affiliate_id)
          .eq("excursion_id", input.excursion_id)
          .maybeSingle();

        if (affLink) {
          const aff = affLink.affiliates as any;
          const commType = (affLink as any).commission_type_override || aff?.commission_type || "PERCENTUAL";
          const commValue = (affLink as any).commission_value_override ?? aff?.commission_value ?? 0;

          let commissionCents = 0;
          if (commType === "PERCENTUAL") {
            commissionCents = Math.round((amountPaid * commValue) / 10000);
          } else {
            commissionCents = commValue * input.seat_numbers.length;
          }

          await supabase.from("affiliate_commissions").insert({
            affiliate_id: input.affiliate_id,
            excursion_id: input.excursion_id,
            order_id: (order as any).id,
            amount_sold_cents: amountPaid,
            commission_cents: commissionCents,
            status: input.payment_type === "TOTAL" ? "CONFIRMADA" : "PENDENTE",
          } as any);
        }
      }

      return order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-seats"] });
      qc.invalidateQueries({ queryKey: ["public-orders"] });
      toast.success("Pedido realizado com sucesso!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}
