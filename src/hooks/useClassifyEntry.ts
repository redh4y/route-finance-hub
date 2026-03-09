import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClassifyResult {
  group_id: string;
  group_name: string;
  subgroup_id: string | null;
  subgroup_name: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export function useClassifyEntry() {
  const { data: groups = [] } = useQuery({
    queryKey: ["dre-groups-for-ai"],
    queryFn: async () => {
      const { data } = await supabase.from("dre_groups").select("id, name, nature");
      return data || [];
    },
  });

  const { data: subgroups = [] } = useQuery({
    queryKey: ["dre-subgroups-for-ai"],
    queryFn: async () => {
      const { data } = await supabase.from("dre_subgroups").select("id, name, group_id");
      return data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (params: { description: string; amount_cents: number; type: string }): Promise<ClassifyResult> => {
      const { data, error } = await supabase.functions.invoke("classify-entry", {
        body: {
          ...params,
          existing_groups: groups.map((g) => ({ id: g.id, name: g.name, nature: g.nature })),
          existing_subgroups: subgroups.map((s) => ({ id: s.id, name: s.name, group_id: s.group_id })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ClassifyResult;
    },
    onError: (error) => {
      toast.error(`Erro na classificação: ${error.message}`);
    },
  });

  return mutation;
}
