import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  UserPlus,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { scoreNamePhone } from "@/lib/phone-match-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayerGroup = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  active: boolean;
  created_at: string;
  member_count?: number;
};

type GroupMember = {
  id: string;
  group_id: string;
  payer_id: string;
  wa_display_name: string | null;
  active: boolean;
  created_at: string;
  payer?: { id: string; name: string; document_digits: string | null };
};

type PayerLite = {
  id: string;
  name: string;
  document_digits: string | null;
  status: string | null;
};

type MatchResult = {
  waName: string;
  topCandidates: { payer: PayerLite; score: number }[];
  selected: PayerLite | null;
  status: "match" | "review" | "none";
};

// ─── Color palette ────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  { value: "blue",   label: "Azul",    badge: "bg-blue-500/15 text-blue-700 border-0" },
  { value: "green",  label: "Verde",   badge: "bg-emerald-500/15 text-emerald-700 border-0" },
  { value: "purple", label: "Roxo",    badge: "bg-purple-500/15 text-purple-700 border-0" },
  { value: "orange", label: "Laranja", badge: "bg-orange-500/15 text-orange-700 border-0" },
  { value: "red",    label: "Vermelho",badge: "bg-red-500/15 text-red-700 border-0" },
  { value: "pink",   label: "Rosa",    badge: "bg-pink-500/15 text-pink-700 border-0" },
  { value: "teal",   label: "Teal",    badge: "bg-teal-500/15 text-teal-700 border-0" },
  { value: "yellow", label: "Amarelo", badge: "bg-yellow-500/15 text-yellow-700 border-0" },
];

function colorBadgeClass(color: string) {
  return GROUP_COLORS.find((c) => c.value === color)?.badge ?? GROUP_COLORS[0].badge;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PayerGroupsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("grupos");
  const [managingGroup, setManagingGroup] = useState<PayerGroup | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [overviewFilter, setOverviewFilter] = useState<string>("all");

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["payer_groups"],
    queryFn: async (): Promise<PayerGroup[]> => {
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

      return (groupRows ?? []).map((g: PayerGroup) => ({
        ...g,
        member_count: countMap[g.id] ?? 0,
      }));
    },
  });

  const { data: allPayers = [] } = useQuery({
    queryKey: ["payers-lite-groups"],
    queryFn: async (): Promise<PayerLite[]> => {
      const { data, error } = await supabase
        .from("payers")
        .select("id,name,document_digits,status")
        .eq("status", "ATIVO")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PayerLite[];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["payer_group_members_all"],
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await (supabase as any)
        .from("payer_group_members")
        .select("*, payer:payers(id,name,document_digits)")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Overview data ────────────────────────────────────────────────────────

  const payerGroupMap = useMemo(() => {
    const map = new Map<string, { group: PayerGroup; waName: string | null }[]>();
    for (const m of allMembers) {
      const group = groups.find((g) => g.id === m.group_id);
      if (!group) continue;
      const list = map.get(m.payer_id) ?? [];
      list.push({ group, waName: m.wa_display_name });
      map.set(m.payer_id, list);
    }
    return map;
  }, [allMembers, groups]);

  const overviewRows = useMemo(() => {
    const payersWithGroups = allPayers.map((p) => ({
      payer: p,
      groups: payerGroupMap.get(p.id) ?? [],
    }));

    let filtered = payersWithGroups;
    if (overviewFilter === "multi") {
      filtered = filtered.filter((r) => r.groups.length >= 2);
    } else if (overviewFilter !== "all") {
      filtered = filtered.filter((r) =>
        r.groups.some((g) => g.group.id === overviewFilter)
      );
    }

    const q = overviewSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.payer.name.toLowerCase().includes(q) ||
          (r.payer.document_digits ?? "").includes(q)
      );
    }

    return filtered;
  }, [allPayers, payerGroupMap, overviewFilter, overviewSearch]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
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

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          <div className="page-header">
            <h1 className="page-title">Grupos de Viagem</h1>
            <p className="page-subtitle">
              Gerencie quais pagadores pertencem a cada grupo de WhatsApp.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="grupos" className="gap-2">
                <Users className="h-4 w-4" />
                Grupos
              </TabsTrigger>
              <TabsTrigger value="visao-geral" className="gap-2">
                <Search className="h-4 w-4" />
                Visão Geral
              </TabsTrigger>
            </TabsList>

            {/* ── Aba Grupos ──────────────────────────────────────────── */}
            <TabsContent value="grupos" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Grupo
                </Button>
              </div>

              {groupsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : groups.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    Nenhum grupo cadastrado. Clique em "Novo Grupo" para começar.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <Card key={group.id}>
                      <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{group.name}</CardTitle>
                          {group.description && (
                            <p className="text-xs text-muted-foreground">{group.description}</p>
                          )}
                        </div>
                        <Badge className={colorBadgeClass(group.color)}>
                          {GROUP_COLORS.find((c) => c.value === group.color)?.label ?? group.color}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{group.member_count}</span>{" "}
                          membro{group.member_count !== 1 ? "s" : ""}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={() => setManagingGroup(group)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Gerenciar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Remover grupo "${group.name}"?`)) {
                                deleteGroup.mutate(group.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Aba Visão Geral ─────────────────────────────────────── */}
            <TabsContent value="visao-geral" className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pagador ou CPF..."
                    className="pl-9"
                    value={overviewSearch}
                    onChange={(e) => setOverviewSearch(e.target.value)}
                  />
                </div>
                <Select value={overviewFilter} onValueChange={setOverviewFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pagadores</SelectItem>
                    <SelectItem value="multi">Em múltiplos grupos</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-6">Pagador</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead className="pr-6">Grupos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overviewRows.map(({ payer, groups: payerGroups }) => (
                          <TableRow key={payer.id}>
                            <TableCell className="pl-6 font-medium text-sm">
                              {payer.name}
                              {payerGroups.length >= 2 && (
                                <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-400/60">
                                  múltiplos grupos
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {payer.document_digits ?? "—"}
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="flex flex-wrap gap-1">
                                {payerGroups.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  payerGroups.map(({ group }) => (
                                    <Badge
                                      key={group.id}
                                      className={`text-[11px] ${colorBadgeClass(group.color)}`}
                                    >
                                      {group.name}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {overviewRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-10 text-sm text-muted-foreground">
                              Nenhum resultado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Modal criar grupo ──────────────────────────────────────────── */}
        <CreateGroupDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["payer_groups"] })}
        />

        {/* ── Modal gerenciar grupo ──────────────────────────────────────── */}
        {managingGroup && (
          <ManageGroupDialog
            group={managingGroup}
            allPayers={allPayers}
            onClose={() => {
              setManagingGroup(null);
              qc.invalidateQueries({ queryKey: ["payer_groups"] });
              qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
            }}
          />
        )}
      </PageTransition>
    </MainLayout>
  );
}

// ─── CreateGroupDialog ────────────────────────────────────────────────────────

function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("payer_groups")
        .insert({ name: name.trim(), color, description: description.trim() || null });
      if (error) throw error;
      toast.success("Grupo criado!");
      onCreated();
      onClose();
      setName("");
      setColor("blue");
      setDescription("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Grupo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome do grupo</Label>
            <Input
              placeholder="Ex: Grupo Escola Municipal XYZ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border-2 ${
                    colorBadgeClass(c.value)
                  } ${color === c.value ? "border-foreground/40 scale-105" : "border-transparent"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input
              placeholder="Ex: Turno da manhã, Rota Sul..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving ? "Criando..." : "Criar Grupo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ManageGroupDialog ────────────────────────────────────────────────────────

function ManageGroupDialog({
  group,
  allPayers,
  onClose,
}: {
  group: PayerGroup;
  allPayers: PayerLite[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState("import");
  const [rawNames, setRawNames] = useState("");
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: currentMembers = [], refetch: refetchMembers } = useQuery({
    queryKey: ["payer_group_members", group.id],
    queryFn: async (): Promise<GroupMember[]> => {
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

  // Set of payer_ids already in this group (to avoid re-suggesting them)
  const existingPayerIds = useMemo(
    () => new Set(currentMembers.map((m) => m.payer_id)),
    [currentMembers]
  );

  const handleAnalyze = () => {
    const names = rawNames
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const results: MatchResult[] = names.map((waName) => {
      const scored = allPayers
        .map((p) => ({ payer: p, score: scoreNamePhone(waName, p.name) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const top = scored[0];
      let status: MatchResult["status"] = "none";
      let selected: PayerLite | null = null;

      if (top && top.score >= 0.85) {
        status = "match";
        selected = top.payer;
      } else if (top && top.score >= 0.60) {
        status = "review";
        selected = top.payer;
      }

      return {
        waName,
        topCandidates: scored.slice(0, 3),
        selected,
        status,
      };
    });

    setMatchResults(results);
    setAnalyzed(true);
  };

  const handleSelectPayer = (idx: number, payerId: string) => {
    const payer = allPayers.find((p) => p.id === payerId) ?? null;
    setMatchResults((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, selected: payer, status: payer ? "match" : "none" }
          : r
      )
    );
  };

  const handleSaveMembers = async () => {
    const toSave = matchResults.filter((r) => r.selected && !existingPayerIds.has(r.selected.id));
    if (toSave.length === 0) {
      toast.info("Nenhum membro novo para salvar.");
      return;
    }
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
      toast.success(`${toSave.length} membro(s) salvos no grupo "${group.name}".`);
      setRawNames("");
      setMatchResults([]);
      setAnalyzed(false);
      refetchMembers();
      qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
      qc.invalidateQueries({ queryKey: ["payer_groups"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
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
              — {currentMembers.length} membro(s) atual(is)
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={subTab} onValueChange={setSubTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="import" className="gap-2">
              <UserPlus className="h-3.5 w-3.5" />
              Importar Nomes
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Membros Atuais ({currentMembers.length})
            </TabsTrigger>
          </TabsList>

          {/* Sub-aba Importar */}
          <TabsContent value="import" className="flex-1 flex flex-col min-h-0 space-y-3 mt-3">
            <div className="space-y-1.5 shrink-0">
              <Label>Nomes do WhatsApp (um por linha)</Label>
              <Textarea
                placeholder={"João da Silva\nMaria 🌸\nPedro Alves"}
                className="h-28 font-mono text-sm resize-none"
                value={rawNames}
                onChange={(e) => { setRawNames(e.target.value); setAnalyzed(false); setMatchResults([]); }}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={handleAnalyze} disabled={!rawNames.trim()} className="gap-2">
                <Search className="h-4 w-4" />
                Analisar
              </Button>
              {analyzed && newCount > 0 && (
                <Button onClick={handleSaveMembers} disabled={saving} variant="default" className="gap-2 ml-auto">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Salvando..." : `Salvar ${newCount} novo(s)`}
                </Button>
              )}
            </div>

            {analyzed && matchResults.length > 0 && (
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Nome no WhatsApp</TableHead>
                      <TableHead>Melhor match</TableHead>
                      <TableHead className="w-16">Score</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="pr-4">Selecionar pagador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchResults.map((r, idx) => {
                      const alreadyIn = r.selected && existingPayerIds.has(r.selected.id);
                      return (
                        <TableRow key={idx} className={alreadyIn ? "opacity-50" : undefined}>
                          <TableCell className="pl-4 text-sm font-medium">{r.waName}</TableCell>
                          <TableCell className="text-sm">
                            {r.selected?.name ?? <span className="text-muted-foreground">—</span>}
                            {alreadyIn && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">já no grupo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.topCandidates[0]
                              ? (r.topCandidates[0].score * 100).toFixed(0) + "%"
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {alreadyIn ? (
                              <Badge variant="secondary" className="text-[10px]">Existente</Badge>
                            ) : r.status === "match" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-0 gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" />
                                Match
                              </Badge>
                            ) : r.status === "review" ? (
                              <Badge className="bg-amber-500/15 text-amber-700 border-0 gap-1 text-[10px]">
                                <AlertTriangle className="h-3 w-3" />
                                Revisar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-destructive border-destructive/50 gap-1 text-[10px]">
                                <XCircle className="h-3 w-3" />
                                Sem match
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="pr-4">
                            {!alreadyIn && (
                              <Select
                                value={r.selected?.id ?? "__none__"}
                                onValueChange={(v) => handleSelectPayer(idx, v === "__none__" ? "" : v)}
                              >
                                <SelectTrigger className="h-8 text-xs w-full max-w-[220px]">
                                  <SelectValue placeholder="Escolher..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                                  {/* Top candidates first */}
                                  {r.topCandidates.map(({ payer, score }) => (
                                    <SelectItem key={payer.id} value={payer.id}>
                                      {payer.name}
                                      <span className="ml-1 text-muted-foreground">
                                        ({(score * 100).toFixed(0)}%)
                                      </span>
                                    </SelectItem>
                                  ))}
                                  {/* Divider + all others not already in top 3 */}
                                  {allPayers
                                    .filter((p) => !r.topCandidates.some((c) => c.payer.id === p.id))
                                    .map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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

          {/* Sub-aba Membros Atuais */}
          <TabsContent value="members" className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[360px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Pagador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome WhatsApp</TableHead>
                    <TableHead className="pr-4 w-16">Remover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-4 text-sm font-medium">
                        {(m.payer as any)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {(m.payer as any)?.document_digits ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.wa_display_name ?? "—"}
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
                  ))}
                  {currentMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                        Nenhum membro ainda. Use a aba "Importar Nomes" para adicionar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
