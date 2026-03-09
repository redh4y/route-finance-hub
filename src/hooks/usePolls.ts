import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Poll Templates ─────────────────────────────────────────────────── */
export function usePollTemplates() {
  return useQuery({
    queryKey: ["poll-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("poll_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        question: string;
        options: string[];
        selectable_count: number;
        active: boolean;
        kind: string;
        created_at: string;
      }>;
    },
  });
}

export function useSavePollTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tpl: {
      id?: string;
      name: string;
      question: string;
      options: string[];
      selectable_count?: number;
      kind?: string;
      active?: boolean;
    }) => {
      if (tpl.id) {
        const { error } = await (supabase as any)
          .from("poll_templates")
          .update({
            name: tpl.name,
            question: tpl.question,
            options: tpl.options,
            selectable_count: tpl.selectable_count ?? 1,
            kind: tpl.kind ?? "daily",
            active: tpl.active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tpl.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("poll_templates")
          .insert({
            name: tpl.name,
            question: tpl.question,
            options: tpl.options,
            selectable_count: tpl.selectable_count ?? 1,
            kind: tpl.kind ?? "daily",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poll-templates"] });
      toast.success("Template salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── WhatsApp Groups ────────────────────────────────────────────────── */
export function useWhatsAppGroups() {
  return useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_groups")
        .select("*, transport_routes(name)")
        .order("name");
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        group_jid: string;
        description: string | null;
        active: boolean;
        route_id: string | null;
        instance_id: string | null;
        synced_at: string | null;
        transport_routes: { name: string } | null;
      }>;
    },
  });
}

export function useImportGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId?: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-polls", {
        body: { action: "import_groups", providerId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao importar grupos");
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      toast.success(`${d.imported} grupos importados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Polls ───────────────────────────────────────────────────────────── */
export function usePolls(date?: string) {
  return useQuery({
    queryKey: ["polls", date],
    queryFn: async () => {
      let query = (supabase as any)
        .from("polls")
        .select("*, whatsapp_groups(name, group_jid), poll_templates(name)")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (date) query = query.eq("poll_date", date);
      const { data, error } = await query;
      if (error) throw error;
      return data as Array<{
        id: string;
        external_poll_id: string | null;
        group_id: string;
        template_id: string | null;
        question: string;
        options: string[];
        selectable_count: number;
        status: string;
        sent_at: string;
        poll_date: string;
        whatsapp_groups: { name: string; group_jid: string } | null;
        poll_templates: { name: string } | null;
      }>;
    },
    refetchInterval: 15_000,
  });
}

export function usePollVotes(pollId: string | null) {
  return useQuery({
    queryKey: ["poll-votes", pollId],
    enabled: !!pollId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("poll_votes")
        .select("*, students(name, registration, phone_e164)")
        .eq("poll_id", pollId)
        .order("voted_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        poll_id: string;
        voter_phone: string | null;
        voter_jid: string | null;
        student_id: string | null;
        selected_option: string;
        voted_at: string;
        vote_status: string;
        students: { name: string; registration: string; phone_e164: string | null } | null;
      }>;
    },
  });
}

export function useSendPoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      groupId: string;
      templateId?: string;
      question?: string;
      options?: string[];
      selectableCount?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-polls", {
        body: { action: "send_poll", ...body },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao enviar enquete");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["polls"] });
      toast.success("Enquete enviada com sucesso.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Instance status ────────────────────────────────────────────────── */
export function useEvolutionStatus() {
  return useQuery({
    queryKey: ["evolution-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-polls", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as { ok: boolean; connected: boolean; provider: { id: string; name: string } };
    },
    refetchInterval: 30_000,
  });
}

/* ── Integration Logs ───────────────────────────────────────────────── */
export function useIntegrationLogs(limit = 100) {
  return useQuery({
    queryKey: ["integration-logs", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integration_logs")
        .select("*")
        .eq("module", "whatsapp_polls")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Array<{
        id: string;
        level: string;
        event_type: string;
        reference_id: string | null;
        message: string;
        payload: unknown;
        created_at: string;
      }>;
    },
    refetchInterval: 15_000,
  });
}

/* ── Group students ─────────────────────────────────────────────────── */
export function useGroupStudents(groupId: string | null) {
  return useQuery({
    queryKey: ["group-students", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_group_students")
        .select("*, students(name, registration, phone_e164, active)")
        .eq("group_id", groupId)
        .eq("active", true);
      if (error) throw error;
      return data as Array<{
        id: string;
        student_id: string;
        students: { name: string; registration: string; phone_e164: string | null; active: boolean };
      }>;
    },
  });
}
