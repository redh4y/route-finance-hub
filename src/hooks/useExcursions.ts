import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Excursion {
  id: string;
  name: string;
  destination: string;
  destination_state: string | null;
  departure_at: string;
  return_at: string | null;
  boarding_location: string | null;
  vehicle_id: string | null;
  drivers: string[];
  total_seats: number;
  seat_price_cents: number;
  notes: string | null;
  status: string;
  cost_center_id: string | null;
  public_token: string | null;
  public_enabled: boolean;
  pix_expiration_minutes: number;
  created_at: string;
  updated_at: string;
  vehicles?: { name: string } | null;
}

export interface Seat {
  id: string;
  excursion_id: string;
  seat_number: number;
  status: string;
  blocked: boolean;
}

export interface Passenger {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
}

export interface TicketSale {
  id: string;
  excursion_id: string;
  passenger_id: string;
  seat_ids: string[];
  seat_numbers: number[];
  amount_cents: number;
  payment_method: string;
  installments: number;
  payment_status: string;
  notes: string | null;
  created_at: string;
  passengers?: Passenger | null;
}

export function useExcursions() {
  return useQuery({
    queryKey: ["excursions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*, vehicles(name)")
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Excursion[];
    },
  });
}

export function useExcursion(id: string | undefined) {
  return useQuery({
    queryKey: ["excursion", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*, vehicles(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Excursion;
    },
  });
}

export function useExcursionSeats(excursionId: string | undefined) {
  return useQuery({
    queryKey: ["excursion-seats", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursion_seats")
        .select("*")
        .eq("excursion_id", excursionId!)
        .order("seat_number", { ascending: true });
      if (error) throw error;
      return data as unknown as Seat[];
    },
  });
}

export function useTicketSales(excursionId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-sales", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("*, passengers(*)")
        .eq("excursion_id", excursionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TicketSale[];
    },
  });
}

export function useCreateExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      destination: string;
      destination_state?: string;
      departure_at: string;
      return_at?: string;
      boarding_location?: string;
      vehicle_id?: string;
      drivers?: string[];
      total_seats: number;
      seat_price_cents: number;
      notes?: string;
    }) => {
      const { data: excursion, error } = await supabase
        .from("excursions")
        .insert({
          name: input.name,
          destination: input.destination,
          destination_state: input.destination_state || null,
          departure_at: input.departure_at,
          return_at: input.return_at || null,
          boarding_location: input.boarding_location || null,
          vehicle_id: input.vehicle_id || null,
          drivers: input.drivers || [],
          total_seats: input.total_seats,
          seat_price_cents: input.seat_price_cents,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Create seats
      const seats = Array.from({ length: input.total_seats }, (_, i) => ({
        excursion_id: excursion.id,
        seat_number: i + 1,
        status: "DISPONIVEL",
      }));
      const { error: seatsError } = await supabase
        .from("excursion_seats")
        .insert(seats);
      if (seatsError) throw seatsError;

      return excursion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excursions"] });
      toast.success("Excursão criada com sucesso");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdateExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<Excursion>) => {
      const { error } = await supabase
        .from("excursions")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excursions"] });
      queryClient.invalidateQueries({ queryKey: ["excursion"] });
      toast.success("Excursão atualizada");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related seats first
      await supabase.from("excursion_seats").delete().eq("excursion_id", id);
      const { error } = await supabase.from("excursions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excursions"] });
      toast.success("Excursão excluída");
    },
    onError: (e) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export function useSellTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      excursion_id: string;
      passenger: { name: string; document?: string; phone?: string; email?: string };
      seat_numbers: number[];
      amount_cents: number;
      payment_method: string;
      installments: number;
      notes?: string;
    }) => {
      // Upsert passenger
      let passengerId: string;
      if (input.passenger.document) {
        const { data: existing } = await supabase
          .from("passengers")
          .select("id")
          .eq("document", input.passenger.document)
          .maybeSingle();
        if (existing) {
          passengerId = existing.id;
          await supabase.from("passengers").update({
            name: input.passenger.name,
            phone: input.passenger.phone || null,
            email: input.passenger.email || null,
          }).eq("id", passengerId);
        } else {
          const { data: newP, error } = await supabase
            .from("passengers")
            .insert({
              name: input.passenger.name,
              document: input.passenger.document || null,
              phone: input.passenger.phone || null,
              email: input.passenger.email || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          passengerId = newP.id;
        }
      } else {
        const { data: newP, error } = await supabase
          .from("passengers")
          .insert({
            name: input.passenger.name,
            phone: input.passenger.phone || null,
            email: input.passenger.email || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        passengerId = newP.id;
      }

      // Update seat statuses
      for (const sn of input.seat_numbers) {
        await supabase
          .from("excursion_seats")
          .update({ status: "VENDIDO" })
          .eq("excursion_id", input.excursion_id)
          .eq("seat_number", sn);
      }

      // Get seat IDs
      const { data: seatRows } = await supabase
        .from("excursion_seats")
        .select("id")
        .eq("excursion_id", input.excursion_id)
        .in("seat_number", input.seat_numbers);

      const seatIds = seatRows?.map((s) => s.id) || [];

      // Create ticket sale
      const { error: saleError } = await supabase.from("ticket_sales").insert({
        excursion_id: input.excursion_id,
        passenger_id: passengerId,
        seat_ids: seatIds,
        seat_numbers: input.seat_numbers,
        amount_cents: input.amount_cents,
        payment_method: input.payment_method,
        installments: input.installments,
        payment_status: "PREVISTO",
        notes: input.notes || null,
      });
      if (saleError) throw saleError;

      // Create financial entry
      const { data: exc } = await supabase
        .from("excursions")
        .select("name, competence_month:departure_at")
        .eq("id", input.excursion_id)
        .single();

      const depDate = exc?.competence_month ? new Date(exc.competence_month) : new Date();
      const compMonth = `${depDate.getFullYear()}-${String(depDate.getMonth() + 1).padStart(2, "0")}`;

      await supabase.from("financial_entries").insert({
        competence_month: compMonth,
        date: new Date().toISOString().split("T")[0],
        type: "RECEITA",
        category: "EXCURSAO",
        description: `Venda assento(s) ${input.seat_numbers.join(",")} - ${exc?.name || "Excursão"}`,
        amount_cents: input.amount_cents,
        source: "AUTO",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excursion-seats"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-sales"] });
      queryClient.invalidateQueries({ queryKey: ["excursions"] });
      toast.success("Venda realizada com sucesso!");
    },
    onError: (e) => toast.error(`Erro na venda: ${e.message}`),
  });
}
