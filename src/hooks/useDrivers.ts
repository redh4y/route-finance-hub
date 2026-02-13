import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Driver {
  id: string;
  name: string;
  cpf: string | null;
  rg: string | null;
  address: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useDrivers() {
  const queryClient = useQueryClient();

  const driversQuery = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Driver[];
    },
  });

  const createDriver = useMutation({
    mutationFn: async (driver: Omit<Driver, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("drivers").insert(driver);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista cadastrado");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDriver = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Driver> & { id: string }) => {
      const { error } = await supabase.from("drivers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDriver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    drivers: driversQuery.data || [],
    isLoading: driversQuery.isLoading,
    createDriver,
    updateDriver,
    deleteDriver,
  };
}
