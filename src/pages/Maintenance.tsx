import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaintenanceTickets, type MaintenancePriority, type MaintenanceStatus, type CreateTicketData, type CompleteTicketData } from "@/hooks/useMaintenanceTickets";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2, XCircle, Sparkles, Paperclip, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

const priorityConfig: Record<MaintenancePriority, { label: string; className: string }> = {
  BAIXA: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
  MEDIA: { label: "Média", className: "bg-accent/10 text-accent border-accent/20" },
  ALTA: { label: "Alta", className: "bg-warning/10 text-warning border-warning/20" },
  CRITICA: { label: "Crítica", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const statusConfig: Record<MaintenanceStatus, { label: string; icon: typeof Wrench }> = {
  ABERTO: { label: "Aberto", icon: AlertTriangle },
  EM_ANALISE: { label: "Em Análise", icon: Clock },
  EM_EXECUCAO: { label: "Em Execução", icon: Wrench },
  AGUARDANDO_PECA: { label: "Aguardando Peça", icon: Clock },
  CONCLUIDO: { label: "Concluído", icon: CheckCircle2 },
  CANCELADO: { label: "Cancelado", icon: XCircle },
};

export default function Maintenance() {
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | "ALL">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [showComplete, setShowComplete] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const { user } = useAuth();

  // Form state
  const [form, setForm] = useState<CreateTicketData>({
    title: "", priority: "MEDIA",
  });

  // Complete form
  const [completeForm, setCompleteForm] = useState<CompleteTicketData>({
    parts_cost_cents: 0, labor_cost_cents: 0, total_cost_cents: 0, cost_type: "CUSTO",
  });

  const { tickets, isLoading, createTicket, updateStatus, completeTicket, deleteTicket } = useMaintenanceTickets({
    status: statusFilter,
    priority: priorityFilter,
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, name, plate").eq("active", true).order("name");
      return data || [];
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, name").eq("active", true).order("name");
      return data || [];
    },
  });

  const { data: dreGroups } = useQuery({
    queryKey: ["dre-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("dre_groups").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: dreSubgroups } = useQuery({
    queryKey: ["dre-subgroups"],
    queryFn: async () => {
      const { data } = await supabase.from("dre_subgroups").select("id, name, group_id").order("name");
      return data || [];
    },
  });

  const filteredSubgroups = dreSubgroups?.filter(s => s.group_id === completeForm.group_id) || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleCreate = () => {
    createTicket.mutate({ ...form, reported_by: user?.email || undefined }, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ title: "", priority: "MEDIA" });
      },
    });
  };

  const handleComplete = () => {
    if (!showComplete) return;
    completeTicket.mutate({ id: showComplete, data: completeForm }, {
      onSuccess: () => {
        setShowComplete(null);
        setCompleteForm({ parts_cost_cents: 0, labor_cost_cents: 0, total_cost_cents: 0, cost_type: "CUSTO" });
      },
    });
  };

  const handleAI = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("maintenance-ai", {
        body: { text: aiText, vehicles: vehicles || [] },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Find vehicle by suggestion
      let vehicleId: string | undefined;
      if (data.vehicle_suggestion && vehicles) {
        const match = vehicles.find(v =>
          v.name.toLowerCase().includes(data.vehicle_suggestion.toLowerCase()) ||
          data.vehicle_suggestion.toLowerCase().includes(v.name.toLowerCase())
        );
        if (match) vehicleId = match.id;
      }

      setForm({
        title: data.title || "",
        description: data.description || "",
        priority: data.priority || "MEDIA",
        category: data.category || "",
        subcategory: data.subcategory || "",
        impact_type: data.impact_type || "",
        vehicle_id: vehicleId || undefined,
      });
      setShowAI(false);
      setShowCreate(true);
      setAiText("");
      toast.success("Sugestões preenchidas pela IA");
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar com IA");
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("maintenance-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("maintenance-attachments").getPublicUrl(path);
      setCompleteForm(prev => ({
        ...prev,
        attachment_urls: [...(prev.attachment_urls || []), urlData.publicUrl],
      }));
      toast.success("Arquivo anexado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openCount = tickets.filter(t => !["CONCLUIDO", "CANCELADO"].includes(t.status)).length;
  const criticalCount = tickets.filter(t => t.priority === "CRITICA" && !["CONCLUIDO", "CANCELADO"].includes(t.status)).length;

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Manutenção de Frota</h1>
            <p className="page-subtitle">Gerencie chamados de manutenção dos veículos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAI(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Relato com IA
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Chamado
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="stat-label">Em aberto</p>
              <p className="stat-value text-xl">{openCount}</p>
            </CardContent>
          </Card>
          <Card className={criticalCount > 0 ? "border-destructive/30" : ""}>
            <CardContent className="pt-4 pb-4">
              <p className="stat-label">Críticos</p>
              <p className="stat-value text-xl text-destructive">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="stat-label">Total de chamados</p>
              <p className="stat-value text-xl">{tickets.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MaintenanceStatus | "ALL")}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos Status</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as MaintenancePriority | "ALL")}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {Object.entries(priorityConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ticket List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">Nenhum chamado encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const StatusIcon = statusConfig[ticket.status]?.icon || Wrench;
              return (
                <Card key={ticket.id} className={ticket.priority === "CRITICA" ? "border-destructive/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold truncate">{ticket.title}</h3>
                          <Badge className={`text-xs ${priorityConfig[ticket.priority].className}`}>
                            {priorityConfig[ticket.priority].label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[ticket.status]?.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {ticket.vehicle_name && <span>🚌 {ticket.vehicle_name}</span>}
                          {ticket.cost_center_name && <span>📁 {ticket.cost_center_name}</span>}
                          {ticket.category && <span>🔧 {ticket.category}</span>}
                          <span>📅 {format(new Date(ticket.reported_at), "dd/MM/yyyy")}</span>
                          {ticket.reported_by && <span>👤 {ticket.reported_by}</span>}
                        </div>
                        {ticket.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ticket.status !== "CONCLUIDO" && ticket.status !== "CANCELADO" && (
                          <>
                            <Select
                              value={ticket.status}
                              onValueChange={(v) => updateStatus.mutate({ id: ticket.id, status: v as MaintenanceStatus })}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => {
                              setShowComplete(ticket.id);
                              setCompleteForm({ parts_cost_cents: 0, labor_cost_cents: 0, total_cost_cents: 0, cost_type: "CUSTO" });
                            }}>
                              Concluir
                            </Button>
                          </>
                        )}
                        {ticket.status === "CONCLUIDO" && ticket.total_cost_cents > 0 && (
                          <span className="text-xs font-medium text-success">
                            R$ {(ticket.total_cost_cents / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* AI Dialog */}
        <Dialog open={showAI} onOpenChange={setShowAI}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Relato Rápido com IA
              </DialogTitle>
              <DialogDescription>
                Descreva o problema de forma livre. A IA irá sugerir campos automaticamente.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder='Ex: "ônibus dourado com problema de freio, muito barulho"'
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAI(false)}>Cancelar</Button>
              <Button onClick={handleAI} disabled={aiLoading || !aiText.trim()}>
                {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Analisar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Chamado de Manutenção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Barulho estranho no motor" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description || ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <Select value={form.vehicle_id || ""} onValueChange={(v) => setForm(f => ({ ...f, vehicle_id: v || undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {vehicles?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro de custo</Label>
                  <Select value={form.cost_center_id || ""} onValueChange={(v) => setForm(f => ({ ...f, cost_center_id: v || undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {costCenters?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade *</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as MaintenancePriority }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input value={form.category || ""} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: MECANICA" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subcategoria</Label>
                  <Input value={form.subcategory || ""} onChange={(e) => setForm(f => ({ ...f, subcategory: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Impacto</Label>
                  <Select value={form.impact_type || ""} onValueChange={(v) => setForm(f => ({ ...f, impact_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seguranca">Segurança</SelectItem>
                      <SelectItem value="conforto">Conforto</SelectItem>
                      <SelectItem value="operacao">Operação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createTicket.isPending || !form.title}>
                Criar Chamado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Dialog */}
        <Dialog open={!!showComplete} onOpenChange={(o) => !o && setShowComplete(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Concluir Chamado - Fechamento Financeiro</DialogTitle>
              <DialogDescription>Informe os custos para gerar o lançamento financeiro automaticamente.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor de Peças (R$)</Label>
                  <Input type="number" step="0.01" value={(completeForm.parts_cost_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const v = Math.round(parseFloat(e.target.value || "0") * 100);
                      setCompleteForm(f => ({ ...f, parts_cost_cents: v, total_cost_cents: v + f.labor_cost_cents }));
                    }} />
                </div>
                <div className="space-y-2">
                  <Label>Mão de Obra (R$)</Label>
                  <Input type="number" step="0.01" value={(completeForm.labor_cost_cents / 100).toFixed(2)}
                    onChange={(e) => {
                      const v = Math.round(parseFloat(e.target.value || "0") * 100);
                      setCompleteForm(f => ({ ...f, labor_cost_cents: v, total_cost_cents: f.parts_cost_cents + v }));
                    }} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium">Total: R$ {(completeForm.total_cost_cents / 100).toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Contábil</Label>
                  <Select value={completeForm.cost_type} onValueChange={(v) => setCompleteForm(f => ({ ...f, cost_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTO">Custo</SelectItem>
                      <SelectItem value="DESPESA">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={completeForm.payment_method || ""} onValueChange={(v) => setCompleteForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grupo DRE</Label>
                  <Select value={completeForm.group_id || ""} onValueChange={(v) => setCompleteForm(f => ({ ...f, group_id: v, subgroup_id: undefined }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {dreGroups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subgrupo DRE</Label>
                  <Select value={completeForm.subgroup_id || ""} onValueChange={(v) => setCompleteForm(f => ({ ...f, subgroup_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {filteredSubgroups.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Serviço</Label>
                  <Input type="date" value={completeForm.service_date || ""} onChange={(e) => setCompleteForm(f => ({ ...f, service_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input value={completeForm.supplier || ""} onChange={(e) => setCompleteForm(f => ({ ...f, supplier: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Anexos</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                    {uploadingFile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                    Anexar arquivo
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                </div>
                {(completeForm.attachment_urls || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {completeForm.attachment_urls!.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Anexo {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowComplete(null)}>Cancelar</Button>
              <Button onClick={handleComplete} disabled={completeTicket.isPending || completeForm.total_cost_cents <= 0}>
                Concluir e Lançar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
