import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseCurrencyInput, toTitleCase } from "./utils";
import type { RouteConfig } from "./types";

interface RoutePricingCardProps {
  onManageRoutes: () => void;
}

export function RoutePricingCard({ onManageRoutes }: RoutePricingCardProps) {
  const qc = useQueryClient();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: routes = [] } = useQuery<RouteConfig[]>({
    queryKey: ["route_config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("route_config")
        .select("route,monthly_amount_cents,updated_at")
        .order("route");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    setInputs((prev) => {
      const next: Record<string, string> = {};
      for (const r of routes) {
        // Keep user's in-progress edit if they've typed something
        if (prev[r.route] !== undefined) {
          next[r.route] = prev[r.route];
        } else if (r.monthly_amount_cents != null) {
          next[r.route] = (r.monthly_amount_cents / 100).toFixed(2).replace(".", ",");
        } else {
          next[r.route] = "";
        }
      }
      return next;
    });
  // Only re-run when the fetched route data changes (reference-stable from React Query)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = routes.map((r) => ({
        route: r.route,
        monthly_amount_cents: parseCurrencyInput(inputs[r.route] ?? ""),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any)
        .from("route_config")
        .upsert(updates, { onConflict: "route" });
      if (error) throw error;
      toast.success("Valores por rota salvos.");
      qc.invalidateQueries({ queryKey: ["route_config"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eff4ff] shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#001e40] flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3
              style={{ fontFamily: "Manrope, sans-serif" }}
              className="text-base font-bold text-[#001e40]"
            >
              Valor Mensal por Rota
            </h3>
            <p className="text-xs text-[#64748b]">Preço cobrado por aluno</p>
          </div>
        </div>
        <button
          onClick={onManageRoutes}
          className="text-[10px] font-bold text-[#001e40] flex items-center gap-1 hover:underline"
          title="Gerenciar rotas"
        >
          <Settings2 className="w-3.5 h-3.5" /> Rotas
        </button>
      </div>

      {routes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Nenhuma rota cadastrada.</p>
      ) : (
        <div className="space-y-3 mb-5">
          {routes.map((r) => (
            <div key={r.route} className="space-y-1">
              <label className="text-xs font-bold text-[#64748b] uppercase tracking-widest">
                {toTitleCase(r.route)}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b] font-medium">R$</span>
                <Input
                  className="pl-9"
                  placeholder="0,00"
                  value={inputs[r.route] ?? ""}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [r.route]: e.target.value }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {routes.length > 0 && (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#001e40] hover:bg-[#003366]"
        >
          {saving ? "Salvando…" : "Salvar Valores"}
        </Button>
      )}
    </div>
  );
}
