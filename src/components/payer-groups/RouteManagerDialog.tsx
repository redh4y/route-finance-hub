import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, MapPin } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCents } from "./utils";
import type { RouteConfig } from "./types";

interface RouteManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RouteManagerDialog({ open, onClose }: RouteManagerDialogProps) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingRoute, setEditingRoute] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const { data: groupRows = [] } = useQuery<{ route: string | null }[]>({
    queryKey: ["payer_groups_routes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_groups")
        .select("route")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const groupsByRoute: Record<string, number> = {};
  for (const row of groupRows) {
    if (row.route) groupsByRoute[row.route] = (groupsByRoute[row.route] ?? 0) + 1;
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["route_config"] });
    qc.invalidateQueries({ queryKey: ["payer_groups"] });
    qc.invalidateQueries({ queryKey: ["payer_groups_routes"] });
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const name = newName.trim().toUpperCase().replace(/\s+/g, "_");
    if (!name) return;
    if (routes.some((r) => r.route === name)) {
      toast.error(`Rota "${name}" já existe.`);
      return;
    }
    setAdding(true);
    try {
      const { error } = await (supabase as any)
        .from("route_config")
        .insert({ route: name });
      if (error) throw error;
      toast.success(`Rota "${name}" criada.`);
      setNewName("");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────

  const startEdit = (route: string) => {
    setEditingRoute(route);
    setEditValue(route);
  };

  const cancelEdit = () => {
    setEditingRoute(null);
    setEditValue("");
  };

  const handleRename = async (oldRoute: string) => {
    const newRoute = editValue.trim().toUpperCase().replace(/\s+/g, "_");
    if (!newRoute || newRoute === oldRoute) { cancelEdit(); return; }
    if (routes.some((r) => r.route === newRoute)) {
      toast.error(`Rota "${newRoute}" já existe.`);
      return;
    }

    try {
      // Insert new route carrying the same price
      const existing = routes.find((r) => r.route === oldRoute);
      const { error: insertErr } = await (supabase as any)
        .from("route_config")
        .insert({ route: newRoute, monthly_amount_cents: existing?.monthly_amount_cents ?? null });
      if (insertErr) throw insertErr;

      // Re-assign groups
      await (supabase as any)
        .from("payer_groups")
        .update({ route: newRoute })
        .eq("route", oldRoute);

      // Delete old route
      const { error: delErr } = await (supabase as any)
        .from("route_config")
        .delete()
        .eq("route", oldRoute);
      if (delErr) throw delErr;

      toast.success(`Rota renomeada para "${newRoute}".`);
      cancelEdit();
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (route: string) => {
    const groupCount = groupsByRoute[route] ?? 0;
    const confirmMsg = groupCount > 0
      ? `A rota "${route}" está em uso por ${groupCount} grupo(s). Os grupos serão desvinculados. Confirmar?`
      : `Excluir rota "${route}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      // Unassign groups
      if (groupCount > 0) {
        await (supabase as any)
          .from("payer_groups")
          .update({ route: null })
          .eq("route", route);
      }
      const { error } = await (supabase as any)
        .from("route_config")
        .delete()
        .eq("route", route);
      if (error) throw error;
      toast.success(`Rota "${route}" excluída.`);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Gerenciar Rotas
          </DialogTitle>
        </DialogHeader>

        {/* Create new route */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome da rota (ex: CAMPINAS)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="uppercase placeholder:normal-case"
          />
          <Button onClick={handleCreate} disabled={!newName.trim() || adding} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>

        {/* Route list */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {routes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma rota cadastrada.
            </p>
          )}
          {routes.map((r) => {
            const groupCount = groupsByRoute[r.route] ?? 0;
            const isEditing = editingRoute === r.route;

            return (
              <div
                key={r.route}
                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <Input
                      className="h-7 text-sm uppercase"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(r.route);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{r.route}</span>
                      {groupCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {groupCount} grupo{groupCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  )}
                  {!isEditing && r.monthly_amount_cents != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCents(r.monthly_amount_cents)}/mês
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                        onClick={() => handleRename(r.route)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={cancelEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(r.route)}
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(r.route)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
