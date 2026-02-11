import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useAffiliates, useCreateAffiliate, useUpdateAffiliate, useDeleteAffiliate,
  useAffiliateCommissions, type Affiliate,
} from "@/hooks/useAffiliates";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Users2, Pencil, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Affiliates() {
  const { data: affiliates, isLoading } = useAffiliates();
  const { data: commissions } = useAffiliateCommissions();
  const createAffiliate = useCreateAffiliate();
  const updateAffiliate = useUpdateAffiliate();
  const deleteAffiliate = useDeleteAffiliate();
  const isMobile = useIsMobile();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [form, setForm] = useState({
    name: "", responsible: "", whatsapp: "", email: "",
    commission_type: "PERCENTUAL", commission_value: "",
    status: "ATIVO",
  });

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
    return (commissions || [])
      .filter((c) => c.affiliate_id === id)
      .reduce((sum, c) => sum + c.commission_cents, 0);
  };

  return (
    <MainLayout>
      <PageTransition>
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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Afiliados</p>
            <p className="text-2xl font-bold">{(affiliates || []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-emerald-400">
              {(affiliates || []).filter((a) => a.status === "ATIVO").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Comissões Totais</p>
            <p className="text-2xl font-bold">
              {formatCurrency((commissions || []).reduce((s, c) => s + c.commission_cents, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : !affiliates || affiliates.length === 0 ? (
        <div className="text-center py-12">
          <Users2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum afiliado cadastrado</p>
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {affiliates.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    {a.responsible && <p className="text-xs text-muted-foreground">{a.responsible}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={a.status === "ATIVO" ? "default" : "outline"} className="text-xs">
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getCommissionLabel(a.commission_type, a.commission_value)}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(getAffiliateEarnings(a.id))}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteAffiliate.mutate(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.responsible || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {a.whatsapp || a.email || "-"}
                    </TableCell>
                    <TableCell>{getCommissionLabel(a.commission_type, a.commission_value)}</TableCell>
                    <TableCell className="text-emerald-400 font-mono">
                      {formatCurrency(getAffiliateEarnings(a.id))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === "ATIVO" ? "default" : "outline"}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteAffiliate.mutate(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Afiliado" : "Novo Afiliado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsible} onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
                <Label>{form.commission_type === "PERCENTUAL" ? "Percentual (ex: 1000 = 10%)" : "Valor fixo (centavos)"}</Label>
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
      </PageTransition>
    </MainLayout>
  );
}
