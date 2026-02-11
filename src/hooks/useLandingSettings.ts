import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LandingSettingsMap = Record<string, { content: any; enabled: boolean; id: string }>;

export function useLandingSettings() {
  return useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_settings")
        .select("*");
      if (error) throw error;
      const settings: LandingSettingsMap = {};
      data?.forEach((row: any) => {
        settings[row.section] = { content: row.content, enabled: row.enabled, id: row.id };
      });
      return settings;
    },
  });
}

export function usePublicExcursions() {
  return useQuery({
    queryKey: ["public-excursions-landing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("id, name, destination, destination_state, departure_at, return_at, boarding_location, seat_price_cents, status, public_token, public_enabled, total_seats")
        .eq("public_enabled", true)
        .in("status", ["ABERTA", "PUBLICADA"])
        .order("departure_at", { ascending: true });
      if (error) throw error;

      // Get seat counts for each excursion
      const excursionsWithAvailability = await Promise.all(
        (data || []).map(async (exc) => {
          const { count } = await supabase
            .from("excursion_seats")
            .select("*", { count: "exact", head: true })
            .eq("excursion_id", exc.id)
            .eq("status", "DISPONIVEL")
            .eq("blocked", false);
          
          const available = count || 0;
          let commercialStatus: "available" | "last_seats" | "sold_out" = "available";
          if (available === 0) commercialStatus = "sold_out";
          else if (available <= 5) commercialStatus = "last_seats";

          return { ...exc, availableSeats: available, commercialStatus };
        })
      );

      return excursionsWithAvailability.filter(e => e.commercialStatus !== "sold_out");
    },
  });
}

export function useUpdateLandingSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ section, content, enabled }: { section: string; content?: any; enabled?: boolean }) => {
      const update: any = { updated_at: new Date().toISOString() };
      if (content !== undefined) update.content = content;
      if (enabled !== undefined) update.enabled = enabled;
      const { error } = await supabase
        .from("landing_settings")
        .update(update)
        .eq("section", section);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-settings"] });
    },
  });
}
