import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Users, UserPlus, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { scoreNamePhone } from "@/lib/phone-match-engine";
import { colorBadgeClass } from "./utils";
import type { PayerGroup, PayerLite, GroupMember, MatchResult, RouteConfig } from "./types";

interface ManageGroupDialogProps {
  group: PayerGroup;
  allPayers: PayerLite[];
  onClose: () => void;
}

export function ManageGroupDialog({ group, allPayers, onClose }: ManageGroupDialogProps) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState("members");
  const [rawNames, setRawNames] = useState("");
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRoute, setEditRoute] = useState(group.route ?? "__none__");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: routeConfigRows = [] } = useQuery<RouteConfig[]>({
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

  const { data: currentMembers = [], refetch: refetchMembers } = useQuery<GroupMember[]>({
    queryKey: ["payer_group_members", group.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_group_members")
        .select("*, payer:payers(id,name,document_digits)")
        .eq("group_id", group.id)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingPayerIds = useMemo(
    () => new Set(currentMembers.filter((m) => m.payer_id).map((m) => m.payer_id!)),
    [currentMembers]
  );

  const handleLinkPayer = async (memberId: string, payerId: string) => {
    const { error } = await (supabase as any)
      .from("payer_group_members")
      .update({ payer_id: payerId, match_status: "ok", best_candidate_name: null, best_candidate_score: null })
      .eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Membro vinculado.");
    refetchMembers();
    qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
    qc.invalidateQueries({ queryKey: ["payer_groups"] });
  };

  const handleAnalyze = () => {
    const names = rawNames.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) return;
    const results: MatchResult[] = names.map((waName) => {
      const scored = allPayers
        .map((p) => ({ payer: p, score: scoreNamePhone(waName, p.name) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      const top = scored[0];
      let status: MatchResult["status"] = "none";
      let selected: PayerLite | null = null;
      if (top && top.score >= 0.85) { status = "match"; selected = top.payer; }
      else if (top && top.score >= 0.6) { status = "review"; selected = top.payer; }
      return { waName, topCandidates: scored.slice(0, 3), selected, status };
    });
    setMatchResults(results);
    setAnalyzed(true);
  };

  const handleSelectPayer = (idx: number, payerId: string) => {
    const payer = payerId === "__none__" ? null : (allPayers.find((p) => p.id === payerId) ?? null);
    setMatchResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: payer, status: payer ? "match" : "none" } : r))
    );
  };

  const handleSaveMembers = async () => {
    const toSave = matchResults.filter((r) => r.selected && !existingPayerIds.has(r.selected.id));
    if (!toSave.length) { toast.info("Nenhum membro novo."); return; }
    setSaving(true);
    try {
      const rows = toSave.map((r) => ({
        group_id: group.id,
        payer_id: r.selected!.id,
        wa_display_name: r.waName,
        active: true,
      }));
      const { error } = await (supabase as any)
        .from("payer_group_members")
        .upsert(rows, { onConflict: "group_id,payer_id" });
      if (error) throw error;
      toast.success(`${toSave.length} membro(s) adicionados.`);
      setRawNames(""); setMatchResults([]); setAnalyzed(false);
      refetchMembers();
      qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
      qc.invalidateQueries({ queryKey: ["payer_groups"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await (supabase as any)
        .from("payer_groups")
        .update({ route: editRoute === "__none__" ? null : editRoute })
        .eq("id", group.id);
      if (error) throw error;
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["payer_groups"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await (supabase as any)
      .from("payer_group_members")
      .update({ active: false })
      .eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Membro removido.");
    refetchMembers();
    qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
    qc.invalidateQueries({ queryKey: ["payer_groups"] });
  };

  const newCount = matchResults.filter(
    (r) => r.selected && !existingPayerIds.has(r.selected.id)
  ).length;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className={colorBadgeClass(group.color)}>{group.name}</Badge>
            <span className="text-muted-foreground font-normal text-sm">
              — {currentMembers.length} membro(s)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Settings bar */}
        <div className="shrink-0 flex gap-3 items-end p-3 bg-muted/20 rounded-lg border">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Rota</Label>
            <Select value={editRoute} onValueChange={setEditRoute}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {routeConfigRows.map((r) => (
                  <SelectItem key={r.route} value={r.route}>{r.route}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="h-8"
          >
            {savingSettings ? "Salvando..." : "Salvar"}
          </Button>
        </div>

        <Tabs value={subTab} onValueChange={setSubTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-3.5 w-3.5" /> Membros Atuais
            </TabsTrigger>
<TabsTrigger value="import" className="gap-2">
              <UserPlus className="h-3.5 w-3.5" /> Adicionar Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="flex-1 min-h-0 mt-3">
            {currentMembers.some((m) => m.match_status !== "ok") && (
              <div className="flex items-center gap-2 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {currentMembers.filter((m) => m.match_status !== "ok").length} membro(s) sem vínculo com pagador — use o select para vincular.
              </div>
            )}
            <ScrollArea className="h-[340px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Pagador / Nome WA</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 w-16">Remover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMembers.map((m) => {
                    const isUnlinked = m.match_status !== "ok";
                    return (
                      <TableRow key={m.id} className={isUnlinked ? "bg-amber-50/60" : undefined}>
                        <TableCell className="pl-4">
                          {isUnlinked ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-amber-800">{m.wa_display_name ?? "—"}</p>
                              <Select onValueChange={(v) => handleLinkPayer(m.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-48 bg-white border-amber-200">
                                  <SelectValue placeholder="Vincular pagador…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allPayers.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-medium">{(m.payer as any)?.name ?? "—"}</p>
                              {m.wa_display_name && (m.payer as any)?.name !== m.wa_display_name && (
                                <p className="text-[10px] text-muted-foreground">{m.wa_display_name}</p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {(m.payer as any)?.document_digits ?? "—"}
                        </TableCell>
                        <TableCell>
                          {isUnlinked ? (
                            <div className="space-y-0.5">
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {m.match_status === "review_ignored" ? "Ignorado" : "Sem match"}
                              </Badge>
                              {m.best_candidate_name && (
                                <p className="text-[10px] text-muted-foreground">
                                  Candidato: {m.best_candidate_name} ({m.best_candidate_score}%)
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                              Vinculado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {currentMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                        Nenhum membro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="import" className="flex-1 flex flex-col min-h-0 space-y-3 mt-3">
            <div className="space-y-1.5 shrink-0">
              <Label>Nomes (um por linha)</Label>
              <Textarea
                placeholder={"João da Silva\nMaria\nPedro"}
                className="h-28 font-mono text-sm resize-none"
                value={rawNames}
                onChange={(e) => { setRawNames(e.target.value); setAnalyzed(false); setMatchResults([]); }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={handleAnalyze} disabled={!rawNames.trim()} className="gap-2">
                <Search className="h-4 w-4" /> Analisar
              </Button>
              {analyzed && newCount > 0 && (
                <Button onClick={handleSaveMembers} disabled={saving} className="gap-2 ml-auto">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Salvando..." : `Salvar ${newCount} novo(s)`}
                </Button>
              )}
            </div>
            {analyzed && matchResults.length > 0 && (
              <ScrollArea className="flex-1 border rounded-md text-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Nome ZAP</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchResults.map((r, idx) => {
                      const alreadyIn = r.selected && existingPayerIds.has(r.selected.id);
                      return (
                        <TableRow key={idx} className={alreadyIn ? "opacity-50" : undefined}>
                          <TableCell className="pl-4 font-medium">{r.waName}</TableCell>
                          <TableCell>
                            {r.selected?.name ?? <span className="text-muted-foreground">—</span>}
                            {alreadyIn && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">já no grupo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="pr-4">
                            {!alreadyIn && (
                              <Select
                                value={r.selected?.id ?? "__none__"}
                                onValueChange={(v) => handleSelectPayer(idx, v)}
                              >
                                <SelectTrigger className="h-7 text-xs w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Ignorar —</SelectItem>
                                  {r.topCandidates.map(({ payer, score }) => (
                                    <SelectItem key={payer.id} value={payer.id}>
                                      {payer.name} ({(score * 100).toFixed(0)}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

