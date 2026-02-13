import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChecklistItem {
  label: string;
  group: string;
  status: "OK" | "AJUSTAR" | "CRITICO" | "NA";
  observation: string;
}

export interface InspectionChecklist {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  inspection_date: string;
  inspector_name: string | null;
  items: ChecklistItem[];
  observations: string | null;
  status: string;
  created_at: string;
  vehicle_name?: string;
  driver_name?: string;
}

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  // Parte Mecânica
  { label: "Nível de óleo do motor", group: "Mecânica", status: "NA", observation: "" },
  { label: "Nível de água/arrefecimento", group: "Mecânica", status: "NA", observation: "" },
  { label: "Nível de combustível", group: "Mecânica", status: "NA", observation: "" },
  { label: "Vazamentos aparentes", group: "Mecânica", status: "NA", observation: "" },
  { label: "Pressão dos pneus", group: "Mecânica", status: "NA", observation: "" },
  { label: "Estado dos pneus (cortes, bolhas, desgaste)", group: "Mecânica", status: "NA", observation: "" },
  { label: "Funcionamento dos freios", group: "Mecânica", status: "NA", observation: "" },
  { label: "Funcionamento do freio de estacionamento", group: "Mecânica", status: "NA", observation: "" },
  { label: "Luzes (farol, seta, freio, ré)", group: "Mecânica", status: "NA", observation: "" },
  { label: "Buzina funcionando", group: "Mecânica", status: "NA", observation: "" },
  // Parte Interna
  { label: "Bancos firmes", group: "Interna", status: "NA", observation: "" },
  { label: "Cintos em bom estado", group: "Interna", status: "NA", observation: "" },
  { label: "Vidros intactos", group: "Interna", status: "NA", observation: "" },
  { label: "Extintor dentro da validade", group: "Interna", status: "NA", observation: "" },
  { label: "Tacógrafo funcionando", group: "Interna", status: "NA", observation: "" },
  { label: "Documento do veículo presente", group: "Interna", status: "NA", observation: "" },
  { label: "Tomadas de carregamento", group: "Interna", status: "NA", observation: "" },
  { label: "Ar-condicionado", group: "Interna", status: "NA", observation: "" },
  // Higiene
  { label: "Lixo removido", group: "Higiene", status: "NA", observation: "" },
  { label: "Chão limpo", group: "Higiene", status: "NA", observation: "" },
  { label: "Painel organizado", group: "Higiene", status: "NA", observation: "" },
  { label: "Cheiro adequado", group: "Higiene", status: "NA", observation: "" },
  { label: "Banheiro limpo (se houver)", group: "Higiene", status: "NA", observation: "" },
  // Documentação
  { label: "Licenciamento em dia", group: "Documentação", status: "NA", observation: "" },
  { label: "Seguro obrigatório ativo", group: "Documentação", status: "NA", observation: "" },
  { label: "Lista de passageiros atualizada", group: "Documentação", status: "NA", observation: "" },
  // Pós-Retorno
  { label: "Verificar novo vazamento", group: "Pós-Retorno", status: "NA", observation: "" },
  { label: "Conferir quilometragem do dia", group: "Pós-Retorno", status: "NA", observation: "" },
  { label: "Registrar consumo médio", group: "Pós-Retorno", status: "NA", observation: "" },
  { label: "Comunicar problemas mecânicos", group: "Pós-Retorno", status: "NA", observation: "" },
  { label: "Agendar manutenção se necessário", group: "Pós-Retorno", status: "NA", observation: "" },
];

export function useInspectionChecklists(vehicleId?: string) {
  const queryClient = useQueryClient();

  const checklistsQuery = useQuery({
    queryKey: ["inspection-checklists", vehicleId],
    queryFn: async () => {
      let query = supabase
        .from("inspection_checklists")
        .select("*")
        .order("inspection_date", { ascending: false })
        .limit(50);

      if (vehicleId) query = query.eq("vehicle_id", vehicleId);

      const { data, error } = await query;
      if (error) throw error;

      const vehicleIds = [...new Set((data || []).map(c => c.vehicle_id))];
      const driverIds = [...new Set((data || []).map(c => c.driver_id).filter(Boolean))];

      const [vRes, dRes] = await Promise.all([
        vehicleIds.length ? supabase.from("vehicles").select("id, name").in("id", vehicleIds) : { data: [] },
        driverIds.length ? supabase.from("drivers").select("id, name").in("id", driverIds as string[]) : { data: [] },
      ]);

      const vMap = new Map((vRes.data || []).map(v => [v.id, v.name]));
      const dMap = new Map((dRes.data || []).map(d => [d.id, d.name]));

      return (data || []).map(c => ({
        ...c,
        items: (c.items as unknown as ChecklistItem[]) || [],
        vehicle_name: vMap.get(c.vehicle_id) || "—",
        driver_name: c.driver_id ? dMap.get(c.driver_id) || "—" : undefined,
      })) as InspectionChecklist[];
    },
  });

  const createChecklist = useMutation({
    mutationFn: async (checklist: {
      vehicle_id: string;
      driver_id?: string;
      inspector_name?: string;
      items: ChecklistItem[];
      observations?: string;
    }) => {
      const hasCritical = checklist.items.some(i => i.status === "CRITICO");
      const row = {
        vehicle_id: checklist.vehicle_id,
        driver_id: checklist.driver_id || null,
        inspector_name: checklist.inspector_name || null,
        items: JSON.parse(JSON.stringify(checklist.items)),
        observations: checklist.observations || null,
        status: hasCritical ? "CRITICO" : "OK",
      };
      const { error } = await supabase.from("inspection_checklists").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspection-checklists"] });
      toast.success("Checklist salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    checklists: checklistsQuery.data || [],
    isLoading: checklistsQuery.isLoading,
    createChecklist,
  };
}
