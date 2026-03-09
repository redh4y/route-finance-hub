import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, MessageCircle, Users, Send, Clock, AlertCircle,
  CheckCircle2, XCircle, Loader2, RefreshCw, Plus, List
} from "lucide-react";
import {
  usePolls, usePollVotes, useSendPoll, useEvolutionStatus,
  useWhatsAppGroups, usePollTemplates, useImportGroups,
  useIntegrationLogs, useGroupStudents, useSavePollTemplate,
} from "@/hooks/usePolls";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Status badge ───────────────────────────────────────────────────── */
function ConnectionBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>
  ) : (
    <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Desconectado</Badge>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function PollDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [tab, setTab] = useState("dashboard");

  const { data: status, isLoading: statusLoading } = useEvolutionStatus();
  const { data: polls = [], isLoading: pollsLoading } = usePolls(selectedDate);
  const { data: votes = [] } = usePollVotes(selectedPollId);
  const { data: groups = [] } = useWhatsAppGroups();
  const { data: templates = [] } = usePollTemplates();
  const { data: logs = [] } = useIntegrationLogs(50);
  const importGroups = useImportGroups();
  const sendPoll = useSendPoll();

  // Derive stats
  const selectedPoll = polls.find((p) => p.id === selectedPollId) || polls[0] || null;
  const activePollId = selectedPollId || selectedPoll?.id || null;
  const { data: pollVotes = [] } = usePollVotes(activePollId);
  const { data: groupStudents = [] } = useGroupStudents(selectedPoll?.group_id || null);

  const votesByOption = useMemo(() => {
    const map: Record<string, typeof pollVotes> = {};
    for (const v of pollVotes) {
      if (!map[v.selected_option]) map[v.selected_option] = [];
      map[v.selected_option].push(v);
    }
    return map;
  }, [pollVotes]);

  const nonRespondents = useMemo(() => {
    const voterIds = new Set(pollVotes.filter((v) => v.student_id).map((v) => v.student_id));
    return groupStudents.filter((gs) => !voterIds.has(gs.student_id));
  }, [pollVotes, groupStudents]);

  const unknownNumbers = useMemo(
    () => pollVotes.filter((v) => !v.student_id),
    [pollVotes],
  );

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Confirmação via WhatsApp
            </h1>
            <p className="page-subtitle">Enquetes diárias para controle de embarque.</p>
          </div>
          <div className="flex items-center gap-2">
            {statusLoading ? (
              <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1" />Verificando...</Badge>
            ) : (
              <ConnectionBadge connected={status?.connected ?? false} />
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="send">Enviar Enquete</TabsTrigger>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* ── Dashboard tab ──────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44"
              />
              <Badge variant="outline">{polls.length} enquete(s)</Badge>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{pollVotes.length}</div>
                  <p className="text-sm text-muted-foreground">Votos recebidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{groupStudents.length}</div>
                  <p className="text-sm text-muted-foreground">Alunos esperados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{nonRespondents.length}</div>
                  <p className="text-sm text-muted-foreground">Não responderam</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{unknownNumbers.length}</div>
                  <p className="text-sm text-muted-foreground">Números não vinculados</p>
                </CardContent>
              </Card>
            </div>

            {/* Polls list */}
            {pollsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Carregando enquetes...
              </div>
            ) : polls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  Nenhuma enquete nesta data.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {polls.map((poll) => (
                  <PollResultCard
                    key={poll.id}
                    poll={poll}
                    isSelected={activePollId === poll.id}
                    onSelect={() => setSelectedPollId(poll.id)}
                    votesByOption={activePollId === poll.id ? votesByOption : {}}
                    totalVotes={activePollId === poll.id ? pollVotes.length : 0}
                    nonRespondents={activePollId === poll.id ? nonRespondents : []}
                    unknownNumbers={activePollId === poll.id ? unknownNumbers : []}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Send poll tab ──────────────────────────────────────── */}
          <TabsContent value="send">
            <SendPollForm
              groups={groups}
              templates={templates}
              onSend={(body) => sendPoll.mutate(body)}
              isSending={sendPoll.isPending}
            />
          </TabsContent>

          {/* ── Groups tab ─────────────────────────────────────────── */}
          <TabsContent value="groups" className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => importGroups.mutate(undefined)}
                disabled={importGroups.isPending || false}
              >
                {importGroups.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Importar da Evolution API</>
                )}
              </Button>
              <Badge variant="outline">{groups.length} grupo(s)</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <Card key={g.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{g.name}</CardTitle>
                      <Badge variant={g.active ? "secondary" : "outline"}>
                        {g.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="truncate">JID: {g.group_jid}</p>
                    {g.transport_routes && <p>Rota: {g.transport_routes.name}</p>}
                    {g.synced_at && (
                      <p>Sincronizado: {format(new Date(g.synced_at), "dd/MM HH:mm")}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {groups.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  Nenhum grupo cadastrado. Importe da Evolution API.
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Templates tab ──────────────────────────────────────── */}
          <TabsContent value="templates">
            <TemplatesSection templates={templates} />
          </TabsContent>

          {/* ── Logs tab ───────────────────────────────────────────── */}
          <TabsContent value="logs" className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum log registrado.</p>
            ) : (
              <div className="rounded-md border divide-y max-h-[600px] overflow-auto">
                {logs.map((log) => (
                  <div key={log.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={log.level === "error" ? "destructive" : log.level === "warn" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {log.level}
                      </Badge>
                      <span className="font-medium">{log.event_type}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageTransition>
    </MainLayout>
  );
}

/* ── Poll result card ───────────────────────────────────────────────── */
function PollResultCard({
  poll,
  isSelected,
  onSelect,
  votesByOption,
  totalVotes,
  nonRespondents,
  unknownNumbers,
}: {
  poll: ReturnType<typeof usePolls>["data"] extends (infer T)[] ? T : never;
  isSelected: boolean;
  onSelect: () => void;
  votesByOption: Record<string, Array<{ student_id: string | null; voter_phone: string | null; voter_jid?: string | null; students: { name: string } | null }>>;
  totalVotes: number;
  nonRespondents: Array<{ students: { name: string } }>;
  unknownNumbers: Array<{ voter_phone: string | null; voter_jid: string | null }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={isSelected ? "ring-2 ring-primary" : ""}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => { onSelect(); setExpanded(!expanded); }}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {poll.question}
          </CardTitle>
          <Badge variant="secondary">{poll.status}</Badge>
        </div>
        <CardDescription>
          {poll.whatsapp_groups?.name || "—"} • Enviada{" "}
          {poll.sent_at ? format(new Date(poll.sent_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}
        </CardDescription>
      </CardHeader>

      {isSelected && (
        <CardContent className="space-y-4">
          {/* Options summary */}
          <div className="space-y-2">
            {(poll.options as string[]).map((opt) => {
              const count = votesByOption[opt]?.length || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={opt}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{opt}</span>
                    <span className="font-bold">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {expanded && (
            <>
              {/* Votes detail */}
              {Object.entries(votesByOption).map(([opt, voters]) => (
                <div key={opt}>
                  <h4 className="text-sm font-semibold mb-1">{opt} ({voters.length})</h4>
                  <div className="text-xs text-muted-foreground space-y-0.5 ml-2">
                    {voters.map((v, i) => (
                      <div key={i}>
                        {v.students?.name || v.voter_phone || v.voter_jid || "Desconhecido"}
                        {!v.student_id && <Badge variant="outline" className="ml-1 text-[10px]">Não vinculado</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Non-respondents */}
              {nonRespondents.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Não responderam ({nonRespondents.length})
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-0.5 ml-2">
                    {nonRespondents.map((nr, i) => (
                      <div key={i}>{nr.students.name}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown numbers */}
              {unknownNumbers.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Números não vinculados ({unknownNumbers.length})
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-0.5 ml-2">
                    {unknownNumbers.map((un, i) => (
                      <div key={i}>{un.voter_phone || un.voter_jid}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Recolher" : "Ver detalhes"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

/* ── Send poll form ─────────────────────────────────────────────────── */
function SendPollForm({
  groups,
  templates,
  onSend,
  isSending,
}: {
  groups: Array<{ id: string; name: string; active: boolean }>;
  templates: Array<{ id: string; name: string; question: string; active: boolean }>;
  onSend: (body: { groupId: string; templateId?: string }) => void;
  isSending: boolean;
}) {
  const [groupId, setGroupId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const activeGroups = groups.filter((g) => g.active);
  const activeTemplates = templates.filter((t) => t.active);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Enviar enquete
        </CardTitle>
        <CardDescription>Escolha o grupo e o template para disparar a enquete.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label>Grupo</Label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
            <SelectContent>
              {activeGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Selecione o template" /></SelectTrigger>
            <SelectContent>
              {activeTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} — {t.question}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => onSend({ groupId, templateId })}
          disabled={!groupId || !templateId || isSending}
        >
          {isSending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Enviar agora</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Templates section ──────────────────────────────────────────────── */
function TemplatesSection({ templates }: { templates: Array<{ id: string; name: string; question: string; options: string[]; selectable_count: number; active: boolean; kind: string }> }) {
  const saveTpl = useSavePollTemplate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", question: "", options: "Vou pegar na rota\nVou pegar no seminário\nNão vou", kind: "daily" });

  const handleSave = () => {
    const opts = form.options.split("\n").map((o) => o.trim()).filter(Boolean);
    if (!form.name || !form.question || opts.length < 2) return;
    saveTpl.mutate({ name: form.name, question: form.question, options: opts, kind: form.kind });
    setOpen(false);
    setForm({ name: "", question: "", options: "Vou pegar na rota\nVou pegar no seminário\nNão vou", kind: "daily" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo template de enquete</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome interno</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Presença noturno" />
              </div>
              <div className="space-y-1">
                <Label>Pergunta</Label>
                <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Ex: Quem vai hoje?" />
              </div>
              <div className="space-y-1">
                <Label>Opções (uma por linha)</Label>
                <Textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} rows={4} />
              </div>
              <Button onClick={handleSave} disabled={saveTpl.isPending}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Badge variant="outline">{templates.length} template(s)</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant={t.active ? "secondary" : "outline"}>{t.active ? "Ativo" : "Inativo"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{t.question}</p>
              <ul className="text-muted-foreground list-disc list-inside">
                {t.options.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
              <Badge variant="outline" className="text-xs mt-1">{t.kind}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
