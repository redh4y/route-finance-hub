import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Users, UserPlus, Search, CheckCircle2, AlertTriangle, ShieldOff, Plus, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PayerGroup, PayerLite, GroupMember, MatchResult, RouteConfig, IgnoreCategory, IgnoreEntry } from "./types";

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
  const [ignoringMember, setIgnoringMember] = useState<GroupMember | null>(null);
  const [linkPending, setLinkPending] = useState<{ member: GroupMember; payer: PayerLite } | null>(null);
  const [searchMember, setSearchMember] = useState("");
  const [removingMember, setRemovingMember] = useState<GroupMember | null>(null);

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

  const { data: ignoreList = [] } = useQuery<{ wa_name: string }[]>({
    queryKey: ["payer_import_ignore_list", "names"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_import_ignore_list")
        .select("wa_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ignoreSet = useMemo(
    () => new Set(ignoreList.map((e) => e.wa_name.trim().toLowerCase())),
    [ignoreList]
  );

  const existingPayerIds = useMemo(
    () => new Set(currentMembers.filter((m) => m.payer_id).map((m) => m.payer_id!)),
    [currentMembers]
  );

  const sortedMembers = useMemo(
    () =>
      [...currentMembers]
        .filter((m) => {
          const name = (m.wa_display_name ?? (m.payer as any)?.name ?? "").trim().toLowerCase();
          return !ignoreSet.has(name);
        })
        .sort((a, b) => {
          const aUnlinked = a.match_status !== "ok" ? 0 : 1;
          const bUnlinked = b.match_status !== "ok" ? 0 : 1;
          return aUnlinked - bUnlinked;
        }),
    [currentMembers, ignoreSet]
  );

  const filteredMembers = useMemo(() => {
    const q = searchMember.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) => {
      const payerName = (m.payer as any)?.name ?? "";
      const waName = m.wa_display_name ?? "";
      return payerName.toLowerCase().includes(q) || waName.toLowerCase().includes(q);
    });
  }, [sortedMembers, searchMember]);

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
    <>
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
            disabled={savingSettings || editRoute === (group.route ?? "__none__")}
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
            <TabsTrigger value="ignored" className="gap-2">
              <ShieldOff className="h-3.5 w-3.5" /> Ignorados
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <UserPlus className="h-3.5 w-3.5" /> Adicionar Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="flex-1 min-h-0 mt-3">
            {sortedMembers.some((m) => m.match_status !== "ok") && (
              <div className="flex items-center gap-2 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {sortedMembers.filter((m) => m.match_status !== "ok").length} membro(s) sem vínculo com pagador — use o select para vincular.
              </div>
            )}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar membro…"
                className="h-8 pl-8 text-sm"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
              />
              {searchMember && (
                <button
                  onClick={() => setSearchMember("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
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
                  {filteredMembers.map((m) => {
                    const isUnlinked = m.match_status !== "ok";
                    return (
                      <TableRow key={m.id} className={isUnlinked ? "bg-amber-50/60" : undefined}>
                        <TableCell className="pl-4">
                          {isUnlinked ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-amber-800">{m.wa_display_name ?? "—"}</p>
                              <Select onValueChange={(payerId) => {
                                const payer = allPayers.find((p) => p.id === payerId);
                                if (payer) setLinkPending({ member: m, payer });
                              }}>
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
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setIgnoringMember(m)}
                              title="Adicionar à lista de ignorados"
                              className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setRemovingMember(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                        {searchMember ? "Nenhum membro encontrado." : "Nenhum membro."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ignored" className="flex-1 min-h-0 mt-3">
            <IgnoredMembersTab groupId={group.id} />
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

    {removingMember && (
      <Dialog open onOpenChange={(v) => !v && setRemovingMember(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-destructive" />
              Remover membro
            </DialogTitle>
            <DialogDescription>
              Remover{" "}
              <span className="font-semibold text-foreground">
                {(removingMember.payer as any)?.name ?? removingMember.wa_display_name ?? "este membro"}
              </span>{" "}
              do grupo?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setRemovingMember(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await handleRemoveMember(removingMember.id);
                setRemovingMember(null);
              }}
            >
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {linkPending && (
      <Dialog open onOpenChange={(v) => !v && setLinkPending(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">Confirmar vínculo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Nome no WhatsApp</p>
              <p className="text-sm font-semibold text-foreground">{linkPending.member.wa_display_name ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span className="text-lg">→</span>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Pagador selecionado</p>
              <p className="text-sm font-bold text-foreground">{linkPending.payer.name}</p>
              {linkPending.payer.document_digits && (
                <p className="text-xs font-mono text-muted-foreground">CPF: {linkPending.payer.document_digits}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setLinkPending(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                await handleLinkPayer(linkPending.member.id, linkPending.payer.id);
                setLinkPending(null);
              }}
            >
              Confirmar vínculo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {ignoringMember && (
      <IgnoreMemberDialog
        member={ignoringMember}
        groupId={group.id}
        onClose={() => setIgnoringMember(null)}
        onConfirmed={() => {
          setIgnoringMember(null);
          refetchMembers();
          qc.invalidateQueries({ queryKey: ["payer_import_ignore_list"] });
          qc.invalidateQueries({ queryKey: ["payer_groups"] });
          qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
          qc.invalidateQueries({ queryKey: ["payer_groups", "with_counts"] });
        }}
      />
    )}
    </>
  );
}

// ── IgnoredMembersTab ─────────────────────────────────────────────────────────

function IgnoredMembersTab({ groupId }: { groupId: string }) {
  const qc = useQueryClient();

  const { data: ignored = [], isLoading } = useQuery<IgnoreEntry[]>({
    queryKey: ["payer_import_ignore_list", "group", groupId],
    queryFn: async () => {
      const [membersResult, byGroupResult] = await Promise.all([
        (supabase as any)
          .from("payer_group_members")
          .select("wa_display_name")
          .eq("group_id", groupId),
        (supabase as any)
          .from("payer_import_ignore_list")
          .select("*, category:payer_ignore_categories!category_id(id,name,created_at)")
          .eq("source_group_id", groupId)
          .order("created_at", { ascending: false }),
      ]);

      const memberNames = [
        ...new Set(
          (membersResult.data ?? [])
            .map((m: { wa_display_name: string | null }) => m.wa_display_name)
            .filter(Boolean) as string[]
        ),
      ];

      const seenIds = new Set<string>();
      const results: IgnoreEntry[] = [];
      for (const e of byGroupResult.data ?? []) {
        if (!seenIds.has(e.id)) { seenIds.add(e.id); results.push(e); }
      }

      if (memberNames.length > 0) {
        const { data: byName } = await (supabase as any)
          .from("payer_import_ignore_list")
          .select("*, category:payer_ignore_categories!category_id(id,name,created_at)")
          .in("wa_name", memberNames)
          .order("created_at", { ascending: false });
        for (const e of byName ?? []) {
          if (!seenIds.has(e.id)) { seenIds.add(e.id); results.push(e); }
        }
      }

      return results;
    },
  });

  const handleRemove = async (entry: IgnoreEntry) => {
    const { error } = await (supabase as any)
      .from("payer_import_ignore_list")
      .delete()
      .eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${entry.wa_name}" removido da lista de ignorados.`);
    qc.invalidateQueries({ queryKey: ["payer_import_ignore_list"] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>;

  if (ignored.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
        <ShieldOff className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Nenhum membro ignorado neste grupo.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[340px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nome no WhatsApp</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="pr-4 w-16">Remover</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ignored.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="pl-4 font-medium text-sm">{e.wa_name}</TableCell>
              <TableCell>
                {e.category?.name ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {e.category.name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="pr-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title="Remover da lista de ignorados"
                  onClick={() => handleRemove(e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ── IgnoreMemberDialog ────────────────────────────────────────────────────────

function IgnoreMemberDialog({
  member,
  groupId,
  onClose,
  onConfirmed,
}: {
  member: GroupMember;
  groupId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: categories = [], refetch: refetchCats } = useQuery<IgnoreCategory[]>({
    queryKey: ["payer_ignore_categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_ignore_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const displayName = member.wa_display_name ?? (member.payer as any)?.name ?? "—";

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const { data, error } = await (supabase as any)
      .from("payer_ignore_categories")
      .insert({ name: trimmed })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    await refetchCats();
    setCategoryId(data.id);
    setNewCatName("");
    setShowNewCat(false);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const catId = categoryId === "__none__" ? null : categoryId;

      // Add to ignore list
      const { error: ignErr } = await (supabase as any)
        .from("payer_import_ignore_list")
        .insert({
          wa_name: displayName,
          category_id: catId,
          source_group_id: groupId,
        });
      if (ignErr) throw ignErr;

      // Soft-delete from ALL groups where wa_display_name matches
      const { error: delErr } = await (supabase as any)
        .from("payer_group_members")
        .update({ active: false })
        .eq("wa_display_name", displayName)
        .eq("active", true);
      if (delErr) throw delErr;

      toast.success(`"${displayName}" ignorado e removido de todos os grupos.`);
      onConfirmed();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldOff className="h-4 w-4 text-amber-500" />
            Ignorar membro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="px-3 py-2 bg-slate-50 rounded-lg border text-sm font-medium text-[#001e40]">
            {displayName}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecionar categoria…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem categoria —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!showNewCat ? (
              <button
                type="button"
                onClick={() => setShowNewCat(true)}
                className="flex items-center gap-1 text-xs text-[#001e40] font-semibold hover:underline"
              >
                <Plus className="h-3 w-3" /> Nova categoria
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="flex-1 h-8 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-[#001e40]"
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                />
                <Button size="sm" onClick={handleCreateCategory} disabled={!newCatName.trim()}>
                  Criar
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-[#94a3b8]">
            O membro será removido do grupo e adicionado à lista de ignorados. Futuras importações desse JSON irão ignorar este nome automaticamente.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {saving ? "Salvando…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

