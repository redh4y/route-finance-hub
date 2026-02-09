import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatMonthRef, getCurrentMonthRef } from "@/lib/formatters";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, mapBillingStatus } from "@/components/ui/status-badge";
import { ArrowUpCircle, Plus, Receipt, DollarSign, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";

interface Billing {
  id: string;
  payer_id: string;
  payer_code?: string | null;
  reference_month: string;
  due_date: string | null;
  status: string;
  amount_expected_cents: number;
  amount_paid_cents: number | null;
  settlement_at: string | null;
  payers?: { name: string | null } | null;
}

interface FinancialEntry {
  id: string;
  competence_month: string;
  date: string;
  type: string;
  category: string;
  description: string;
  amount_cents: number;
  source: string;
}


export default function FinancialRevenue() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");

  const queryClient = useQueryClient();

  const { data: dreGroups } = useQuery({
    queryKey: ["dre-groups", "RECEITA"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_groups")
        .select("id, name, nature")
        .eq("nature", "RECEITA")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; nature: string }[];
    },
  });

  const { data: dreSubgroups } = useQuery({
    queryKey: ["dre-subgroups", groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_subgroups")
        .select("id, name, group_id")
        .eq("group_id", groupId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; group_id: string }[];
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, type, active")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; type: string; active: boolean }[];
    },
  });

  const groupById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    (dreGroups || []).forEach((group) => {
      map.set(group.id, { name: group.name });
    });
    return map;
  }, [dreGroups]);

  const subgroupById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    (dreSubgroups || []).forEach((subgroup) => {
      map.set(subgroup.id, { name: subgroup.name });
    });
    return map;
  }, [dreSubgroups]);


  // Get billings for the month
  const { data: billings, isLoading: loadingBillings } = useQuery({
    queryKey: ["billings", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billings")
        .select("*, payers(name)")
        .eq("reference_month", selectedMonth)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Billing[];
    },
  });

  // Get manual revenue entries
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["financial-entries", selectedMonth, "revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("competence_month", selectedMonth)
        .eq("type", "RECEITA")
        .eq("source", "MANUAL")
        .order("date", { ascending: false });

      if (error) throw error;
      return data as FinancialEntry[];
    },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!groupId) {
        throw new Error("Selecione um grupo.");
      }
      if ((dreSubgroups?.length || 0) > 0 && !subgroupId) {
        throw new Error("Selecione um subgrupo.");
      }
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      const group = groupById.get(groupId);
      const subgroup = subgroupId ? subgroupById.get(subgroupId) : null;
      
      const { error } = await supabase.from("financial_entries").insert({
        competence_month: selectedMonth,
        date,
        type: "RECEITA",
        category: group?.name || "",
        subcategory: subgroup?.name || null,
        description,
        amount_cents: amountCents,
        source: "MANUAL",
        group_id: groupId,
        subgroup_id: subgroupId || null,
        cost_center_id: costCenterId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Receita registrada com sucesso");
      setGroupId("");
      setSubgroupId("");
      setCostCenterId("");
      setDescription("");
      setAmount("");
    },
    onError: (error) => {
      toast.error("Erro ao registrar receita: " + error.message);
    },
  });

  const hasSubgroups = (dreSubgroups?.length || 0) > 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const filteredBillings = useMemo(() => {
    if (!billings) return [];
    if (!statusFilter) return billings;
    return billings.filter((b) => b.status === statusFilter);
  }, [billings, statusFilter]);

  // Calculate totals
  const expectedRevenue = billings?.filter(b => b.status !== "CANCELADO").reduce((sum, b) => sum + b.amount_expected_cents, 0) || 0;
  const paidBillings = billings?.filter(b => b.status === "PAID").reduce((sum, b) => sum + (b.amount_paid_cents || b.amount_expected_cents), 0) || 0;
  const manualRevenue = entries?.reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const actualRevenue = paidBillings + manualRevenue;
  const pendingRevenue = billings?.filter(b => b.status === "OPEN").reduce((sum, b) => sum + b.amount_expected_cents, 0) || 0;

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Entradas</h1>
            <p className="page-subtitle">Receitas e cobran??as</p>
          </div>
          <div className="flex items-center gap-3">
            {statusFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete("status");
                  setSearchParams(next);
                }}
              >
                Limpar filtro
              </Button>
            )}
            {statusFilter && <Badge variant="outline">Status: {statusFilter}</Badge>}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {formatMonthRef(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="finance-card-neutral">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Entrada Presumida</p>
                <p className="stat-value">{formatCurrency(expectedRevenue)}</p>
              </div>
              <Receipt className="h-8 w-8 text-accent/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="finance-card-positive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Entrada Atual</p>
                <p className="stat-value text-success">{formatCurrency(actualRevenue)}</p>
              </div>
              <ArrowUpCircle className="h-8 w-8 text-success/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="finance-card-warning">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Pendente</p>
                <p className="stat-value text-warning">{formatCurrency(pendingRevenue)}</p>
              </div>
              <Clock className="h-8 w-8 text-warning/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Receitas Manuais</p>
                <p className="stat-value">{formatCurrency(manualRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Receita Manual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={groupId} onValueChange={(v) => {
                setGroupId(v);
                setSubgroupId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {dreGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasSubgroups && (
              <div className="space-y-2">
                <Label>Subgrupo</Label>
                <Select value={subgroupId} onValueChange={setSubgroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dreSubgroups?.map((subgroup) => (
                      <SelectItem key={subgroup.id} value={subgroup.id}>
                        {subgroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Centro de custo (opcional)</Label>
              <Select
                value={costCenterId || ""}
                onValueChange={(value) => setCostCenterId(value === "__none__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem centro de custo</SelectItem>
                  {costCenters?.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      {center.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição da receita..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createEntry.mutate()}
              disabled={
                !groupId ||
                (hasSubgroups && !subgroupId) ||
                !amount ||
                !description ||
                createEntry.isPending
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Receita
            </Button>
          </CardContent>
        </Card>

        {/* Billings list */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Boletos do Mês - {formatMonthRef(selectedMonth)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBillings ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredBillings && filteredBillings.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagador</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBillings.slice(0, 20).map((billing) => (
                        <TableRow key={billing.id}>
                          <TableCell>
                            {billing.due_date ? formatDate(billing.due_date) : "-"}
                          </TableCell>
                        <TableCell className="text-sm">
                          {billing.payers?.name || billing.payer_id}
                        </TableCell>
                          <TableCell>
                            <StatusBadge status={mapBillingStatus(billing.status)} />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(billing.amount_expected_cents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredBillings.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      ... e mais {filteredBillings.length - 20} boletos
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum boleto neste mês
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual entries */}
          {entries && entries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Receitas Manuais</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.category}</Badge>
                          {entry.subcategory && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {entry.subcategory}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-mono text-success">
                          +{formatCurrency(entry.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

