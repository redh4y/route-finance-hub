import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Bus, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GroupRow } from "./GroupCard";
import { RouteAuditDialog } from "./RouteAuditDialog";
import { toTitleCase } from "./utils";
import type { PayerGroup, RouteConfig } from "./types";

interface RouteSectionProps {
  onManage: (group: PayerGroup) => void;
}

export function RouteSection({ onManage }: RouteSectionProps) {
  const qc = useQueryClient();
  const [auditRoute, setAuditRoute] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<PayerGroup | null>(null);

  const { data: groups = [], isLoading } = useQuery<PayerGroup[]>({
    queryKey: ["payer_groups", "with_counts"],
    queryFn: async () => {
      const { data: groupRows, error } = await (supabase as any)
        .from("payer_groups")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: counts } = await (supabase as any)
        .from("payer_group_members")
        .select("group_id")
        .eq("active", true);

      const countMap: Record<string, number> = {};
      for (const row of counts ?? []) {
        countMap[row.group_id] = (countMap[row.group_id] ?? 0) + 1;
      }

      const unmatchedMap: Record<string, number> = {};
      const { data: unmatched } = await (supabase as any)
        .from("payer_group_members")
        .select("group_id,match_status")
        .eq("active", true)
        .in("match_status", ["unmatched", "review_ignored"]);
      for (const row of unmatched ?? []) {
        unmatchedMap[row.group_id] = (unmatchedMap[row.group_id] ?? 0) + 1;
      }

      return (groupRows ?? []).map((g: PayerGroup) => ({
        ...g,
        member_count: countMap[g.id] ?? 0,
        unmatched_count: unmatchedMap[g.id] ?? 0,
      }));
    },
  });

  const { data: routePricingRows = [] } = useQuery<RouteConfig[]>({
    queryKey: ["route_config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("route_config")
        .select("route,monthly_amount_cents,updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const routePricing = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const r of routePricingRows) map[r.route] = r.monthly_amount_cents;
    return map;
  }, [routePricingRows]);

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate members first, then the group
      await (supabase as any)
        .from("payer_group_members")
        .update({ active: false })
        .eq("group_id", id);
      const { error } = await (supabase as any)
        .from("payer_groups")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payer_groups"] }); // invalidates both base + "with_counts"
      qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
      toast.success("Grupo removido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const routeGroups = useMemo(() => {
    const map = new Map<string, PayerGroup[]>();
    for (const g of groups) {
      const key = g.route ?? "__none__";
      const list = map.get(key) ?? [];
      list.push(g);
      map.set(key, list);
    }
    return map;
  }, [groups]);

  if (isLoading) {
    return <p className="text-sm text-[#64748b]">Carregando grupos...</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="p-10 text-center bg-[#ffffff] rounded-xl border border-[#eff4ff]">
        <p className="text-[#64748b]">
          Nenhum grupo cadastrado. Use o botão Novo Grupo ou importe um JSON pela lateral.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {Array.from(routeGroups.entries()).map(([routeKey, routeGps]) => {
        const isNone = routeKey === "__none__";
        const label = isNone ? "Não Atribuída" : toTitleCase(routeKey);
        const totalMembers = routeGps.reduce((acc, g) => acc + (g.member_count ?? 0), 0);

        return (
          <section key={routeKey}>
            <div className="flex items-center justify-between mb-6 border-b border-[#e5eeff] pb-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-[#ffffff] ${isNone ? "bg-[#94a3b8]" : "bg-[#003366]"}`}
                >
                  {isNone ? <MapIcon className="w-6 h-6" /> : <Bus className="w-6 h-6" />}
                </div>
                <div>
                  <h2
                    style={{ fontFamily: "Manrope, sans-serif" }}
                    className="text-2xl font-bold text-[#001e40]"
                  >
                    Rota: {label}
                  </h2>
                  <p className="text-sm font-medium text-[#64748b]">
                    {routeGps.length} grupo(s) · {totalMembers} aluno(s)
                  </p>
                </div>
              </div>
              {!isNone && (
                <button
                  onClick={() => setAuditRoute(routeKey)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#001e40] border-2 border-[#dce9ff] hover:bg-[#eff4ff] transition-colors"
                >
                  <BarChart3 className="w-4 h-4" /> Auditoria
                </button>
              )}
            </div>

            <div className="rounded-xl border border-[#e5eeff] overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f4f8ff] text-[#64748b] text-xs font-bold uppercase tracking-wide">
                    <th className="text-left px-4 py-3 w-4"></th>
                    <th className="text-left px-4 py-3">Grupo</th>
                    <th className="text-center px-4 py-3">Alunos</th>
                    <th className="text-right px-4 py-3">Valor/mês</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {routeGps.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
                      routePricing={routePricing}
                      onManage={onManage}
                      onDelete={(g) => setDeletingGroup(g)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {auditRoute && (
        <RouteAuditDialog
          route={auditRoute}
          open={!!auditRoute}
          onClose={() => setAuditRoute(null)}
        />
      )}

      <Dialog open={!!deletingGroup} onOpenChange={(v) => !v && setDeletingGroup(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-red-500" />
              Excluir grupo
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o grupo{" "}
              <span className="font-semibold text-foreground">"{deletingGroup?.name}"</span>?
              <br />
              Todos os membros serão desvinculados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeletingGroup(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteGroup.isPending}
              onClick={() => {
                if (deletingGroup) {
                  deleteGroup.mutate(deletingGroup.id);
                  setDeletingGroup(null);
                }
              }}
            >
              {deleteGroup.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
