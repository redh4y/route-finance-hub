import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, BarChart3, Trash2, DollarSign, MapPin, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GroupRow } from "./GroupCard";
import { RouteAuditDialog } from "./RouteAuditDialog";
import { toTitleCase, formatCents, parseCurrencyInput } from "./utils";
import type { PayerGroup, RouteConfig } from "./types";

interface RouteSectionProps {
  onManage: (group: PayerGroup) => void;
  onManageRoutes?: () => void;
}

export function RouteSection({ onManage, onManageRoutes }: RouteSectionProps) {
  const qc = useQueryClient();
  const [auditRoute, setAuditRoute] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<PayerGroup | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");

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
      qc.invalidateQueries({ queryKey: ["payer_groups"] });
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

  const handleSavePrice = async (route: string) => {
    const cents = parseCurrencyInput(priceInput);
    try {
      const { error } = await (supabase as any)
        .from("route_config")
        .upsert({ route, monthly_amount_cents: cents, updated_at: new Date().toISOString() }, { onConflict: "route" });
      if (error) throw error;
      toast.success("Valor atualizado.");
      qc.invalidateQueries({ queryKey: ["route_config"] });
      setEditingPrice(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/30">
        <Bus className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum grupo cadastrado</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Crie um grupo manualmente ou importe dados via JSON na aba "Importar".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Array.from(routeGroups.entries()).map(([routeKey, routeGps]) => {
        const isNone = routeKey === "__none__";
        const label = isNone ? "Sem Rota" : toTitleCase(routeKey);
        const totalMembers = routeGps.reduce((acc, g) => acc + (g.member_count ?? 0), 0);
        const price = !isNone ? routePricing[routeKey] : undefined;
        const isEditingThis = editingPrice === routeKey;

        return (
          <section key={routeKey} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Route header */}
            <div className="flex items-center justify-between px-5 py-4 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isNone ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                  {isNone ? <MapPin className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">{label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {routeGps.length} grupo{routeGps.length !== 1 ? "s" : ""} · {totalMembers} aluno{totalMembers !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Inline price display/edit */}
                {!isNone && (
                  <div className="flex items-center gap-1.5">
                    {isEditingThis ? (
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <Input
                            autoFocus
                            className="h-8 w-28 pl-7 text-sm"
                            placeholder="0,00"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice(routeKey);
                              if (e.key === "Escape") setEditingPrice(null);
                            }}
                          />
                        </div>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleSavePrice(routeKey)}>
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPrice(routeKey);
                          setPriceInput(price != null ? (price / 100).toFixed(2).replace(".", ",") : "");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Editar valor mensal da rota"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        {price != null ? formatCents(price) : "Definir valor"}/mês
                      </button>
                    )}
                  </div>
                )}

                {!isNone && (
                  <button
                    onClick={() => setAuditRoute(routeKey)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Auditoria
                  </button>
                )}
              </div>
            </div>

            {/* Groups table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="text-left px-5 py-2.5 w-4"></th>
                    <th className="text-left px-3 py-2.5">Grupo</th>
                    <th className="text-center px-3 py-2.5">Alunos</th>
                    <th className="text-center px-3 py-2.5">Pendências</th>
                    <th className="text-right px-5 py-2.5">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {routeGps.map((group) => (
                    <GroupRow
                      key={group.id}
                      group={group}
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
              <Trash2 className="h-4 w-4 text-destructive" />
              Excluir grupo
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o grupo{" "}
              <span className="font-semibold text-foreground">"{deletingGroup?.name}"</span>?
              <br />
              Todos os membros serão desvinculados.
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
