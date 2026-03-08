import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAffiliates, useCreateAffiliate, useUpdateAffiliate, useDeleteAffiliate,
  useAffiliateCommissions, type Affiliate,
} from "@/hooks/useAffiliates";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Users2, Pencil, Trash2, DollarSign, Search, UserCheck, UserX, TrendingUp, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

export default function Affiliates() {
  const { data: affiliates, isLoading } = useAffiliates();
  const { data: commissions } = useAffiliateCommissions();
  const createAffiliate = useCreateAffiliate();
  const updateAffiliate = useUpdateAffiliate();
  const deleteAffiliate = useDeleteAffiliate();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ATIVO" | "INATIVO">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Affiliate | null>(null);
  const [form, setForm] = useState({
    name: "", responsible: "", whatsapp: "", email: "",
    commission_type: "PERCENTUAL", commission_value: "",
    status: "ATIVO",
  });

  const all = affiliates || [];
  const filtered = all.filter((a) => {
    const matchSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.responsible || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCommissions = (commissions || []).reduce((s, c) => s + c.commission_cents, 0);
  const activeCount = all.filter((a) => a.status === "ATIVO").length;

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", responsible: "", whatsapp: "", email: "", commission_type: "PERCENTUAL", commission_value: "", status: "ATIVO" });
    setDialogOpen(true);
  };

  const openEdit = (a: Affiliate) => {
    setEditing(a);
    setForm({
      name: a.name,
      responsible: a.responsible || "",
      whatsapp: a.whatsapp || "",
      email: a.email || "",
      commission_type: a.commission_type,
      commission_value: String(a.commission_value),
      status: a.status,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    const payload = {
      name: form.name,
      responsible: form.responsible || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      commission_type: form.commission_type,
      commission_value: parseInt(form.commission_value) || 0,
      status: form.status,
    };
    if (editing) {
      updateAffiliate.mutate({ id: editing.id, ...payload } as any, { onSuccess: () => setDialogOpen(false) });
    } else {
      createAffiliate.mutate(payload as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const getCommissionLabel = (type: string, value: number) => {
    if (type === "PERCENTUAL") return `${(value / 100).toFixed(1)}%`;
    return formatCurrency(value);
  };

  const getAffiliateEarnings = (id: string) => {
    return (commissions || []).filter((c) => c.affiliate_id === id).reduce((sum, c) => sum + c.commission_cents, 0);
  };

  const statCards = [
    { label: "Total Afiliados", value: all.length, icon: Users2, color: "text-accent" },
    { label: "Ativos", value: activeCount, icon: UserCheck, color: "text-success" },
    { label: "Inativos", value: all.length - activeCount, icon: UserX, color: "text-muted-foreground" },
    { label: "Comissões Totais", value: formatCurrency(totalCommissions), icon: TrendingUp, color: "text-warning" },
  ];

  return (
    <MainLayout>
      <PageTransition>
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="page-title">Afiliados</h1>
              <p className="page-subtitle">Gerencie parceiros e comissões de vendas</p>
            </div>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Afiliado
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
          {statCards.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold">{s.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar afiliado..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1.5">
            {(["ALL", "ATIVO", "INATIVO"] as const).map((f) => (
              <Button
                key={f}
                variant={statusFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f)}
              >
                {f === "ALL" ? "Todos" : f === "ATIVO" ? "Ativos" : "Inativos"}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="pt-4 pb-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Users2 className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-1">Nenhum afiliado encontrado</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Crie um afiliado para vincular a excursões</p>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo Afiliado
            </Button>
          </motion.div>
        ) : isMobile ? (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm truncate">{a.name}</p>
                            <Badge variant={a.status === "ATIVO" ? "default" : "outline"} className="text-[10px] shrink-0">
                              {a.status}
                            </Badge>
                          </div>
                          {a.responsible && <p className="text-xs text-muted-foreground">{a.responsible}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {getCommissionLabel(a.commission_type, a.commission_value)}
                            </span>
                            <span className="font-mono font-semibold text-success">
                              {formatCurrency(getAffiliateEarnings(a.id))}
                            </span>
                          </div>
                          {(a.whatsapp || a.email) && (
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/60">
                              {a.whatsapp && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.whatsapp}</span>}
                              {a.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.email}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(a)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Ganhos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.responsible || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {a.whatsapp && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{a.whatsapp}</div>}
                        {a.email && <div className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{a.email}</div>}
                        {!a.whatsapp && !a.email && "-"}
                      </TableCell>
                      <TableCell className="text-sm">{getCommissionLabel(a.commission_type, a.commission_value)}</TableCell>
                      <TableCell className="font-mono font-semibold text-sm text-success">{formatCurrency(getAffiliateEarnings(a.id))}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "ATIVO" ? "default" : "outline"} className="text-[10px]">{a.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(a)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">{filtered.length} afiliado(s)</p>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Afiliado" : "Novo Afiliado"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome do afiliado" />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsible} onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))} placeholder="Nome do responsável" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de comissão</Label>
                  <Select value={form.commission_type} onValueChange={(v) => setForm((f) => ({ ...f, commission_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTUAL">Percentual</SelectItem>
                      <SelectItem value="FIXO">Valor Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{form.commission_type === "PERCENTUAL" ? "% (ex: 1000 = 10%)" : "Valor (centavos)"}</Label>
                  <Input type="number" value={form.commission_value} onChange={(e) => setForm((f) => ({ ...f, commission_value: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createAffiliate.isPending || updateAffiliate.isPending}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir afiliado?</AlertDialogTitle>
              <AlertDialogDescription>
                O afiliado <strong>{deleteTarget?.name}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (deleteTarget) deleteAffiliate.mutate(deleteTarget.id); setDeleteTarget(null); }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageTransition>
    </MainLayout>
  );
}
