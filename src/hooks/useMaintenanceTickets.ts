import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MaintenancePriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type MaintenanceStatus = "ABERTO" | "EM_ANALISE" | "EM_EXECUCAO" | "AGUARDANDO_PECA" | "CONCLUIDO" | "CANCELADO";

export interface MaintenanceTicket {
  id: string;
  vehicle_id: string | null;
  cost_center_id: string | null;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reported_by: string | null;
  reported_at: string;
  category: string | null;
  subcategory: string | null;
  impact_type: string | null;
  sla_deadline: string | null;
  completed_at: string | null;
  parts_cost_cents: number;
  labor_cost_cents: number;
  total_cost_cents: number;
  cost_type: string | null;
  group_id: string | null;
  subgroup_id: string | null;
  payment_method: string | null;
  service_date: string | null;
  supplier: string | null;
  financial_entry_id: string | null;
  attachment_urls: string[];
  created_at: string;
  updated_at: string;
  // Joined
  vehicle_name?: string;
  cost_center_name?: string;
}

export interface CreateTicketData {
  vehicle_id?: string | null;
  cost_center_id?: string | null;
  title: string;
  description?: string;
  priority: MaintenancePriority;
  category?: string;
  subcategory?: string;
  impact_type?: string;
  reported_by?: string;
}

export interface CompleteTicketData {
  parts_cost_cents: number;
  labor_cost_cents: number;
  total_cost_cents: number;
  cost_type: string;
  group_id?: string;
  subgroup_id?: string;
  payment_method?: string;
  service_date?: string;
  supplier?: string;
  attachment_urls?: string[];
}

export function useMaintenanceTickets(filters?: {
  status?: MaintenanceStatus | "ALL";
  priority?: MaintenancePriority | "ALL";
  vehicle_id?: string;
  startDate?: string;
  endDate?: string;
}) {
  const queryClient = useQueryClient();

  const ticketsQuery = useQuery({
    queryKey: ["maintenance-tickets", filters],
    queryFn: async () => {
      let query = supabase
        .from("maintenance_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "ALL") {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority && filters.priority !== "ALL") {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.vehicle_id) {
        query = query.eq("vehicle_id", filters.vehicle_id);
      }
      if (filters?.startDate) {
        query = query.gte("reported_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("reported_at", filters.endDate + "T23:59:59");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch vehicle and cost center names
      const vehicleIds = [...new Set((data || []).map(t => t.vehicle_id).filter(Boolean))];
      const ccIds = [...new Set((data || []).map(t => t.cost_center_id).filter(Boolean))];

      const [vehiclesRes, ccRes] = await Promise.all([
        vehicleIds.length > 0
          ? supabase.from("vehicles").select("id, name").in("id", vehicleIds as string[])
          : { data: [] },
        ccIds.length > 0
          ? supabase.from("cost_centers").select("id, name").in("id", ccIds as string[])
          : { data: [] },
      ]);

      const vehicleMap = new Map((vehiclesRes.data || []).map(v => [v.id, v.name]));
      const ccMap = new Map((ccRes.data || []).map(c => [c.id, c.name]));

      return (data || []).map(t => ({
        ...t,
        vehicle_name: t.vehicle_id ? vehicleMap.get(t.vehicle_id) || "—" : undefined,
        cost_center_name: t.cost_center_id ? ccMap.get(t.cost_center_id) || "—" : undefined,
      })) as MaintenanceTicket[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (data: CreateTicketData) => {
      if (!data.vehicle_id && !data.cost_center_id) {
        throw new Error("Informe veículo ou centro de custo");
      }
      const { error } = await supabase.from("maintenance_tickets").insert({
        vehicle_id: data.vehicle_id || null,
        cost_center_id: data.cost_center_id || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        category: data.category || null,
        subcategory: data.subcategory || null,
        impact_type: data.impact_type || null,
        reported_by: data.reported_by || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      toast.success("Chamado criado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "CONCLUIDO") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("maintenance_tickets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      toast.success("Status atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const completeTicket = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompleteTicketData }) => {
      // 1. Create financial entry
      const ticket = ticketsQuery.data?.find(t => t.id === id);
      if (!ticket) throw new Error("Chamado não encontrado");

      const competenceMonth = new Date().toISOString().slice(0, 7);
      const { data: feData, error: feError } = await supabase.from("financial_entries").insert({
        competence_month: competenceMonth,
        date: data.service_date || new Date().toISOString().split("T")[0],
        type: data.cost_type,
        category: "MANUTENCAO",
        description: `Manutenção: ${ticket.title}`,
        amount_cents: data.total_cost_cents,
        source: "AUTO",
        vehicle_id: ticket.vehicle_id || undefined,
        cost_center_id: ticket.cost_center_id || undefined,
        group_id: data.group_id || undefined,
        subgroup_id: data.subgroup_id || undefined,
        payment_method: data.payment_method || undefined,
      }).select("id").single();
      if (feError) throw feError;

      // 2. Update ticket
      const { error } = await supabase.from("maintenance_tickets").update({
        status: "CONCLUIDO" as MaintenanceStatus,
        completed_at: new Date().toISOString(),
        parts_cost_cents: data.parts_cost_cents,
        labor_cost_cents: data.labor_cost_cents,
        total_cost_cents: data.total_cost_cents,
        cost_type: data.cost_type,
        group_id: data.group_id || null,
        subgroup_id: data.subgroup_id || null,
        payment_method: data.payment_method || null,
        service_date: data.service_date || null,
        supplier: data.supplier || null,
        financial_entry_id: feData.id,
        attachment_urls: data.attachment_urls || [],
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-dash-financial"] });
      toast.success("Chamado concluído e lançamento financeiro criado");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-tickets"] });
      toast.success("Chamado excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    tickets: ticketsQuery.data || [],
    isLoading: ticketsQuery.isLoading,
    error: ticketsQuery.error,
    createTicket,
    updateStatus,
    completeTicket,
    deleteTicket,
  };
}

export function useMaintenanceDashboardStats() {
  return useQuery({
    queryKey: ["maintenance-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tickets")
        .select("id, status, priority, sla_deadline")
        .not("status", "in", '("CONCLUIDO","CANCELADO")');
      if (error) throw error;

      const tickets = data || [];
      const now = new Date().toISOString();
      return {
        openCount: tickets.length,
        criticalCount: tickets.filter(t => t.priority === "CRITICA" || t.priority === "ALTA").length,
        overdueCount: tickets.filter(t => t.sla_deadline && t.sla_deadline < now).length,
      };
    },
    staleTime: 30_000,
  });
}
