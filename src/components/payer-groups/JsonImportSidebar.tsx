import { useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud, FileJson, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, ChevronDown, ChevronUp, Trash2, ShieldOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { scoreNamePhone } from "@/lib/phone-match-engine";
import type { ImportQueueItem, PayerLite, MatchResult, GroupMember, RouteConfig, IgnoreEntry } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function parseJsonFile(text: string): { parsed: { grupo: string; membros: string[] } | null; error: string | null } {
  try {
    const obj = JSON.parse(text);
    if (!obj.grupo || !Array.isArray(obj.membros)) {
      return { parsed: null, error: 'Esperado { "grupo": "...", "membros": [...] }' };
    }
    return { parsed: { grupo: String(obj.grupo), membros: obj.membros.map(String) }, error: null };
  } catch {
    return { parsed: null, error: "JSON com formatação incorreta." };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JsonImportSidebar() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: allPayers = [] } = useQuery<PayerLite[]>({
    queryKey: ["payers-lite-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payers")
        .select("id,name,document_digits,status")
        .eq("status", "ATIVO")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PayerLite[];
    },
  });

  const { data: existingGroups = [] } = useQuery<{ id: string; name: string; route: string | null; color: string }[]>({
    queryKey: ["payer_groups_lite"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_groups")
        .select("id,name,route,color")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: routeConfigRows = [] } = useQuery<RouteConfig[]>({
    queryKey: ["route_config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("route_config")
        .select("route,monthly_amount_cents,updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const routeOptions = useMemo(
    () => routeConfigRows.map((r) => r.route),
    [routeConfigRows]
  );

  const { data: ignoreEntries = [] } = useQuery<IgnoreEntry[]>({
    queryKey: ["payer_import_ignore_list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payer_import_ignore_list")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ignoreSet = useMemo(
    () => new Set(ignoreEntries.map((e) => e.wa_name.trim().toLowerCase())),
    [ignoreEntries]
  );

  // ── Analysis ───────────────────────────────────────────────────────────────

  const runAnalysisForItem = async (id: string, membros: string[]) => {
    const toProcess = membros.filter((n) => !ignoreSet.has(n.trim().toLowerCase()));
    const skippedCount = membros.length - toProcess.length;

    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAnalyzing: true, analyzed: false, matchResults: [], skippedCount } : item
      )
    );

    const CHUNK = 8;
    const results: MatchResult[] = [];

    for (let i = 0; i < toProcess.length; i += CHUNK) {
      const chunk = toProcess.slice(i, i + CHUNK);
      for (const waName of chunk) {
        const scored = allPayers
          .map((p) => ({ payer: p, score: scoreNamePhone(waName, p.name) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        const top = scored[0];
        let status: MatchResult["status"] = "none";
        let selected: PayerLite | null = null;
        if (top && top.score >= 0.85) { status = "match"; selected = top.payer; }
        else if (top && top.score >= 0.6) { status = "review"; selected = top.payer; }
        results.push({ waName, topCandidates: scored.slice(0, 3), selected, status });
      }

      const snapshot = [...results];
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, matchResults: snapshot } : item))
      );
      await new Promise((r) => setTimeout(r, 0));
    }

    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAnalyzing: false, analyzed: true, matchResults: results, skippedCount } : item
      )
    );
  };

  // ── Load existing members for a group ──────────────────────────────────────

  const loadExistingMembers = async (groupId: string): Promise<GroupMember[]> => {
    const { data } = await (supabase as any)
      .from("payer_group_members")
      .select("*, payer:payers(id,name,document_digits)")
      .eq("group_id", groupId)
      .eq("active", true);
    return data ?? [];
  };

  // ── Add files to queue ─────────────────────────────────────────────────────

  const addFilesToQueue = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      const text = await file.text();
      const { parsed, error } = parseJsonFile(text);
      if (!parsed) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }

      const existingGroup = existingGroups.find(
        (g) => g.name.trim().toLowerCase() === parsed.grupo.trim().toLowerCase()
      );

      const item: ImportQueueItem = {
        id: uid(),
        fileName: file.name,
        parsed,
        parseError: error,
        routeConfig: existingGroup?.route ?? "__none__",
        matchResults: [],
        skippedCount: 0,
        analyzed: false,
        isAnalyzing: false,
        existingMembers: [],
        saving: false,
        saved: false,
      };

      setQueue((prev) => [...prev, item]);
      setExpanded((prev) => ({ ...prev, [item.id]: true }));

      if (existingGroup) {
        loadExistingMembers(existingGroup.id).then((members) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, existingMembers: members } : q))
          );
        });
      }

      runAnalysisForItem(item.id, parsed.membros);
    }
  };

  // ── Save item ──────────────────────────────────────────────────────────────

  const saveItem = async (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (!item || !item.parsed) return;

    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, saving: true } : q))
    );

    try {
      const routeVal = item.routeConfig === "__none__" ? null : item.routeConfig;
      const existingGroupEntry = existingGroups.find(
        (g) => g.name.trim().toLowerCase() === item.parsed!.grupo.trim().toLowerCase()
      );

      const { data: groupData, error: groupErr } = await (supabase as any)
        .from("payer_groups")
        .upsert(
          { name: item.parsed.grupo, color: (existingGroupEntry as any)?.color ?? "blue", route: routeVal, active: true },
          { onConflict: "name" }
        )
        .select("id")
        .single();
      if (groupErr) throw groupErr;
      const groupId = groupData.id;

      const existingPayerIds = new Set(item.existingMembers.filter((m) => m.payer_id).map((m) => m.payer_id!));

      // 1. Upsert matched members (payer_id set)
      const matched = item.matchResults.filter((r) => r.selected);
      if (matched.length > 0) {
        const rows = matched.map((r) => ({
          group_id: groupId,
          payer_id: r.selected!.id,
          wa_display_name: r.waName,
          match_status: "ok",
          best_candidate_name: null,
          best_candidate_score: null,
          active: true,
        }));
        const { error: membErr } = await (supabase as any)
          .from("payer_group_members")
          .upsert(rows, { onConflict: "group_id,payer_id" });
        if (membErr) throw membErr;
      }

      // 2. Replace unmatched/ignored members for this group (clear old, insert new)
      const unmatched = item.matchResults.filter((r) => !r.selected);
      await (supabase as any)
        .from("payer_group_members")
        .delete()
        .eq("group_id", groupId)
        .is("payer_id", null);
      if (unmatched.length > 0) {
        const unmatchedRows = unmatched.map((r) => {
          const top = r.topCandidates[0];
          return {
            group_id: groupId,
            payer_id: null,
            wa_display_name: r.waName,
            match_status: top && top.score >= 0.6 ? "review_ignored" : "unmatched",
            best_candidate_name: top?.payer.name ?? null,
            best_candidate_score: top ? Math.round(top.score * 100) : null,
            active: true,
          };
        });
        const { error: unmatchErr } = await (supabase as any)
          .from("payer_group_members")
          .insert(unmatchedRows);
        if (unmatchErr) throw unmatchErr;
      }

      // 3. Deactivate matched members removed from the JSON
      const incomingIds = new Set(matched.map((r) => r.selected!.id));
      const toRemove = item.existingMembers.filter(
        (m) => m.payer_id && !incomingIds.has(m.payer_id)
      );
      if (toRemove.length > 0) {
        const { error: remErr } = await (supabase as any)
          .from("payer_group_members")
          .update({ active: false })
          .in("id", toRemove.map((m) => m.id));
        if (remErr) throw remErr;
      }

      const added = matched.filter((r) => r.selected && !existingPayerIds.has(r.selected.id)).length;
      const unmatchedMsg = unmatched.length > 0 ? ` · ${unmatched.length} sem vínculo` : "";
      toast.success(
        existingGroupEntry
          ? `"${item.parsed.grupo}" atualizado: +${added}, -${toRemove.length}${unmatchedMsg}`
          : `Grupo "${item.parsed.grupo}" criado com ${matched.length} vinculados${unmatchedMsg}.`
      );

      qc.invalidateQueries({ queryKey: ["payer_groups"] });
      qc.invalidateQueries({ queryKey: ["payer_groups_lite"] });
      qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });

      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, saving: false, saved: true } : q))
      );
    } catch (e: any) {
      toast.error(e.message);
      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, saving: false } : q))
      );
    }
  };

  const saveAll = async () => {
    const pending = queue.filter((q) => q.analyzed && !q.saved && !q.saving);
    for (const item of pending) {
      await saveItem(item.id);
    }
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
    setExpanded((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  };

  const updateRoute = (id: string, value: string) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, routeConfig: value } : q))
    );
  };

  const updateSelected = (itemId: string, matchIdx: number, payerId: string) => {
    const payer = payerId === "__none__" ? null : (allPayers.find((p) => p.id === payerId) ?? null);
    setQueue((prev) =>
      prev.map((q) =>
        q.id === itemId
          ? {
              ...q,
              matchResults: q.matchResults.map((r, i) =>
                i === matchIdx ? { ...r, selected: payer, status: payer ? "match" : "none" } : r
              ),
            }
          : q
      )
    );
  };

  const pendingCount = queue.filter((q) => q.analyzed && !q.saved && !q.saving).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#dce9ff] rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-6 bg-[#001e40] text-[#ffffff]">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <FileJson className="w-5 h-5" /> Importar Dados JSON
        </h3>
        <p className="text-sm opacity-80 mt-1">Selecione um ou mais arquivos .json</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-[#003366]/30 bg-[#eff4ff] rounded-xl p-8 text-center flex flex-col items-center justify-center group cursor-pointer hover:bg-[#e5eeff] transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFilesToQueue(e.dataTransfer.files); }}
        >
          <UploadCloud className="w-8 h-8 text-[#001e40]/40 group-hover:text-[#001e40] mb-2 transition-colors" />
          <p className="text-sm font-bold text-[#001e40]">Arraste arquivos JSON</p>
          <p className="text-xs text-slate-500">ou clique para selecionar (múltiplos permitidos)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) { addFilesToQueue(e.target.files); e.target.value = ""; } }}
          />
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="space-y-3">
            {queue.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                expanded={!!expanded[item.id]}
                routeOptions={routeOptions}
                allPayers={allPayers}
                existingGroupName={existingGroups.find(
                  (g) => g.name.trim().toLowerCase() === item.parsed?.grupo.trim().toLowerCase()
                )?.name}
                onToggle={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                onRouteChange={(v) => updateRoute(item.id, v)}
                onSelectPayer={(idx, pid) => updateSelected(item.id, idx, pid)}
                onSave={() => saveItem(item.id)}
                onRemove={() => removeItem(item.id)}
              />
            ))}

            {pendingCount > 1 && (
              <button
                onClick={saveAll}
                className="w-full py-3 bg-[#001e40] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#003366] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Importar Todos ({pendingCount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── QueueCard ─────────────────────────────────────────────────────────────────

interface QueueCardProps {
  item: ImportQueueItem;
  expanded: boolean;
  routeOptions: string[];
  existingGroupName?: string;
  allPayers: PayerLite[];
  onToggle: () => void;
  onRouteChange: (v: string) => void;
  onSelectPayer: (idx: number, payerId: string) => void;
  onSave: () => void;
  onRemove: () => void;
}

function QueueCard({
  item, expanded, routeOptions, existingGroupName, allPayers,
  onToggle, onRouteChange, onSelectPayer, onSave, onRemove,
}: QueueCardProps) {
  const existingPayerIds = useMemo(
    () => new Set(item.existingMembers.map((m) => m.payer_id)),
    [item.existingMembers]
  );

  const diffStats = useMemo(() => {
    if (!item.analyzed || item.existingMembers.length === 0) return null;
    const incoming = new Set(item.matchResults.filter((r) => r.selected).map((r) => r.selected!.id));
    const toAdd = item.matchResults.filter((r) => r.selected && !existingPayerIds.has(r.selected.id));
    const toRemove = item.existingMembers.filter((m) => !incoming.has(m.payer_id));
    return { toAdd, toRemove };
  }, [item.analyzed, item.matchResults, item.existingMembers, existingPayerIds]);

  const reviewItems = item.matchResults.filter(
    (r) => (r.status === "review" || r.status === "none") && !(r.selected && existingPayerIds.has(r.selected.id))
  );
  const hasReview = reviewItems.length > 0;

  const statusIcon = item.saved
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    : item.isAnalyzing
    ? <RefreshCw className="w-4 h-4 text-[#001e40] animate-spin shrink-0" />
    : hasReview
    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
    : item.analyzed
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />;

  return (
    <div className={`rounded-xl border overflow-hidden ${item.saved ? "border-emerald-200 bg-emerald-50/50" : "border-[#e5eeff] bg-white"}`}>
      {/* Card header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#001e40] truncate">{item.parsed?.grupo ?? item.fileName}</p>
          <p className="text-[10px] text-slate-400 truncate">{item.fileName} · {item.parsed?.membros.length ?? 0} membros</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {existingGroupName
            ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 shadow-none text-[10px]">Atualizar</Badge>
            : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 shadow-none text-[10px]">Novo</Badge>
          }
          {item.saved && <Badge className="bg-emerald-200 text-emerald-900 hover:bg-emerald-200 shadow-none text-[10px]">Importado ✓</Badge>}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Card body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#eff4ff] pt-3">
          {/* Route select */}
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Rota</Label>
            <Select value={item.routeConfig} onValueChange={onRouteChange}>
              <SelectTrigger className="h-8 text-xs bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {routeOptions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Analyzing indicator */}
          {item.isAnalyzing && (
            <div className="flex items-center gap-2 text-xs text-[#001e40] font-medium bg-[#eff4ff] p-2 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Analisando… {item.matchResults.length}/{(item.parsed?.membros.length ?? 0) - item.skippedCount}
            </div>
          )}

          {item.skippedCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <ShieldOff className="w-3 h-3 shrink-0" />
              {item.skippedCount} nome(s) ignorado(s) pela lista de ignorados
            </div>
          )}

          {/* Diff stats */}
          {diffStats && (
            <div className="flex gap-1.5 flex-wrap">
              {diffStats.toAdd.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  +{diffStats.toAdd.length} novos
                </span>
              )}
              {diffStats.toRemove.length > 0 && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                  -{diffStats.toRemove.length} remover
                </span>
              )}
            </div>
          )}

          {/* Match preview table */}
          {item.matchResults.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-[#e5eeff] max-h-48 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#eff4ff] text-slate-500 font-bold uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5">Nome</th>
                    <th className="px-3 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {item.matchResults.slice(0, 50).map((r, i) => {
                    const alreadyIn = r.selected && existingPayerIds.has(r.selected.id);
                    return (
                      <tr key={i} className={alreadyIn ? "bg-slate-50/50" : ""}>
                        <td className="px-3 py-1.5 font-medium text-[#001e40] truncate max-w-[140px]" title={r.waName}>
                          {r.waName}
                        </td>
                        <td className="px-3 py-1.5">
                          {alreadyIn ? (
                            <span className="text-[10px] text-slate-400 font-medium">Mantido</span>
                          ) : r.status === "match" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : r.status === "review" ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                              <AlertTriangle className="w-3 h-3" />
                              {r.selected ? `${r.topCandidates[0] ? (r.topCandidates.find(c => c.payer.id === r.selected?.id)?.score ?? 0) * 100 | 0 : 0}%` : "Rev."}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-red-500 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Sem match
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {item.matchResults.length > 50 && (
                    <tr>
                      <td colSpan={2} className="text-center py-2 italic text-slate-400 text-[10px]">
                        … e mais {item.matchResults.length - 50} membros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Review selects */}
          {hasReview && (
            <div className="space-y-1">
              {/* review group (score 60–84) */}
              {reviewItems.filter((r) => r.status === "review").length > 0 && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 space-y-2">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Match incerto — confirme
                  </p>
                  {reviewItems.filter((r) => r.status === "review").map((r) => {
                    const idx = item.matchResults.indexOf(r);
                    return (
                      <ReviewRow key={idx} r={r} idx={idx} allPayers={allPayers} onSelectPayer={onSelectPayer} />
                    );
                  })}
                </div>
              )}
              {/* none group (score < 60) */}
              {reviewItems.filter((r) => r.status === "none").length > 0 && (
                <div className="bg-red-50 p-3 rounded-xl border border-red-100 space-y-2">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Sem match — vincule manualmente
                  </p>
                  {reviewItems.filter((r) => r.status === "none").map((r) => {
                    const idx = item.matchResults.indexOf(r);
                    return (
                      <ReviewRow key={idx} r={r} idx={idx} allPayers={allPayers} onSelectPayer={onSelectPayer} showAll />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!item.saved && (
              <button
                onClick={onSave}
                disabled={!item.analyzed || item.saving || item.isAnalyzing}
                className="flex-1 py-2.5 bg-[#001e40] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#003366] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${item.saving ? "animate-spin" : ""}`} />
                {item.saving ? "Salvando…" : "Importar"}
              </button>
            )}
            <button
              onClick={onRemove}
              className="p-2.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remover da fila"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({
  r, idx, allPayers, onSelectPayer, showAll = false,
}: {
  r: MatchResult;
  idx: number;
  allPayers: PayerLite[];
  onSelectPayer: (idx: number, payerId: string) => void;
  showAll?: boolean;
}) {
  const options = showAll ? allPayers : r.topCandidates.map((c) => c.payer);
  const scoreMap = new Map(r.topCandidates.map((c) => [c.payer.id, c.score]));

  return (
    <div className="flex gap-2 items-center">
      <span className="text-[10px] font-bold text-slate-600 truncate w-24 shrink-0" title={r.waName}>
        {r.waName}
      </span>
      <Select value={r.selected?.id ?? "__none__"} onValueChange={(v) => onSelectPayer(idx, v)}>
        <SelectTrigger className="h-7 text-[10px] flex-1 bg-white">
          <SelectValue placeholder="Vincular pagador…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Ignorar —</SelectItem>
          {options.map((payer) => {
            const score = scoreMap.get(payer.id);
            return (
              <SelectItem key={payer.id} value={payer.id}>
                {payer.name}{score != null ? ` (${(score * 100).toFixed(0)}%)` : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
