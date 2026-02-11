import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { defaultPublicSiteContent, type PublicSiteContent } from "@/lib/publicSiteDefaults";
import { TAVARES_PHONE_DISPLAY, TAVARES_WHATSAPP_URL } from "@/lib/contact";

const PAGE_KEY = "public-excursoes-home";

type PublicSiteRow = {
  id: string;
  page_key: string;
  title: string | null;
  content_json: PublicSiteContent | null;
  active_sections: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

export function usePublicSiteContent() {
  return useQuery({
    queryKey: ["public-site-content", PAGE_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_site_content")
        .select("*")
        .eq("page_key", PAGE_KEY)
        .maybeSingle();

      if (error) {
        return {
          row: null,
          content: defaultPublicSiteContent,
        };
      }

      const row = (data || null) as PublicSiteRow | null;
      const merged = {
        ...defaultPublicSiteContent,
        ...(row?.content_json || {}),
      } as PublicSiteContent;

      // Keep contact references consistent in the public UI.
      merged.whatsappUrl = TAVARES_WHATSAPP_URL;
      merged.contactPhone = TAVARES_PHONE_DISPLAY;
      if (!merged.budgetUrl || merged.budgetUrl.includes("wa.me/5500000000000")) {
        merged.budgetUrl = `${TAVARES_WHATSAPP_URL}?text=Ol%C3%A1%2C+quero+um+orcamento+de+transporte`;
      }

      return {
        row,
        content: merged,
      };
    },
  });
}

export function useSavePublicSiteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: PublicSiteContent) => {
      const payload = {
        page_key: PAGE_KEY,
        title: "Landing Excursoes",
        content_json: content,
        active_sections: {
          services: content.showServices,
          fleet: content.showFleet,
          differentials: content.showDifferentials,
          trust: content.showTrust,
          finalCta: content.showFinalCta,
        },
      };

      const { data: existing, error: findError } = await (supabase as any)
        .from("public_site_content")
        .select("id")
        .eq("page_key", PAGE_KEY)
        .maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        const { error } = await (supabase as any)
          .from("public_site_content")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("public_site_content").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-site-content"] });
      toast.success("Configuracoes publicas salvas");
    },
    onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

