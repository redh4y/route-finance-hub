import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
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
import { ArrowDownCircle, Plus, DollarSign, Trash2, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface FinancialEntry {
  id: string;
  competence_month: string;
  date: string;
  type: string;
  category: string;
  subcategory: string | null;
  installment_current?: number | null;
  installment_total?: number | null;
  description: string;
  amount_cents: number;
  source: string;
  created_at: string;
  vehicle_id?: string | null;
}
interface AllocationRow {
  id: string;
  entry_id: string;
  vehicle_id: string;
  amount_cents: number;
}
type AllocationDraft = {
  vehicleId: string;
  amount: string;
};
export default function FinancialExpenses() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [entryType, setEntryType] = useState<"CUSTO" | "DESPESA">("CUSTO");
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleId, setVehicleId] = useState("");
  const [allocationEntry, setAllocationEntry] = useState<FinancialEntry | null>(null);
  const [allocationRows, setAllocationRows] = useState<AllocationDraft[]>([]);

  const queryClient = useQueryClient();

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate, active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; plate: string | null; active: boolean }[];
    },
  });
  const activeVehicles = useMemo(
    () => (vehicles || []).filter((vehicle) => vehicle.active),
    [vehicles]
  );
  const vehicleById = useMemo(() => {
    const map = new Map<string, { name: string; plate: string | null }>();
    (vehicles || []).forEach((vehicle) => {
      map.set(vehicle.id, { name: vehicle.name, plate: vehicle.plate });
    });
    return map;
  }, [vehicles]);

  const { data: dreGroups } = useQuery({
    queryKey: ["dre-groups", entryType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_groups")
        .select("id, name, nature")
        .eq("nature", entryType)
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

  const { data: entries, isLoading } = useQuery({
    queryKey: ["financial-entries", selectedMonth, "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .or(`competence_month.eq.${selectedMonth},invoice_month.eq.${selectedMonth}`)
        .in("type", ["CUSTO", "DESPESA"])
        .order("date", { ascending: false });

      if (error) throw error;
      return data as FinancialEntry[];
    },
  });

  const entryIds = useMemo(() => (entries || []).map((e) => e.id), [entries]);
  const { data: allocations } = useQuery({
    queryKey: ["financial-entry-allocations", selectedMonth],
    enabled: entryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entry_allocations")
        .select("id, entry_id, vehicle_id, amount_cents")
        .in("entry_id", entryIds);
      if (error) throw error;
      return data as AllocationRow[];
    },
  });

  const allocationsByEntry = useMemo(() => {
    const map = new Map<string, AllocationRow[]>();
    (allocations || []).forEach((row) => {
      const existing = map.get(row.entry_id) || [];
      existing.push(row);
      map.set(row.entry_id, existing);
    });
    return map;
  }, [allocations]);

  const createEntry = useMutation({
    mutationFn: async () => {
      if (entryType === "CUSTO" && !vehicleId) {
        throw new Error("Selecione um veiculo para custos operacionais.");
      }
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
        type: entryType,
        category: group?.name || "",
        subcategory: subgroup?.name || null,
        description,
        amount_cents: amountCents,
        source: "MANUAL",
        vehicle_id: vehicleId || null,
        group_id: groupId,
        subgroup_id: subgroupId || null,
        cost_center_id: costCenterId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Lan?amento criado com sucesso");
      // Reset form
      setGroupId("");
      setSubgroupId("");
      setCostCenterId("");
      setDescription("");
      setAmount("");
      setVehicleId("");
    },
    onError: (error) => {
      toast.error("Erro ao criar lan?amento: " + error.message);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Lan?amento exclu?do");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const saveAllocations = useMutation({
    mutationFn: async () => {
      if (!allocationEntry) return;
      if (allocationRows.length === 0) {
        throw new Error("Adicione ao menos um veiculo no rateio.");
      }

      const parsed = allocationRows.map((row) => ({
        vehicleId: row.vehicleId,
        amountCents: Math.round(parseFloat(row.amount.replace(",", ".")) * 100),
      }));

      if (parsed.some((row) => !row.vehicleId || Number.isNaN(row.amountCents) || row.amountCents <= 0)) {
        throw new Error("Preencha todos os veiculos e valores corretamente.");
      }

      const total = parsed.reduce((sum, row) => sum + row.amountCents, 0);
      if (total !== allocationEntry.amount_cents) {
        throw new Error("A soma do rateio deve ser igual ao valor do lancamento.");
      }

      const { error: deleteError } = await supabase
        .from("financial_entry_allocations")
        .delete()
        .eq("entry_id", allocationEntry.id);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("financial_entry_allocations")
        .insert(
          parsed.map((row) => ({
            entry_id: allocationEntry.id,
            vehicle_id: row.vehicleId,
            amount_cents: row.amountCents,
          }))
        );
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("financial_entries")
        .update({ vehicle_id: null })
        .eq("id", allocationEntry.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entry-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      toast.success("Rateio salvo com sucesso");
      setAllocationEntry(null);
      setAllocationRows([]);
    },
    onError: (error) => {
      toast.error("Erro ao salvar rateio: " + error.message);
    },
  });
  const hasSubgroups = (dreSubgroups?.length || 0) > 0;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const totalCustos = entries?.filter((e) => e.type === "CUSTO").reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const totalDespesas = entries?.filter((e) => e.type === "DESPESA").reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const getInstallmentLabel = (entry: FinancialEntry) => {
    if (entry.installment_total && entry.installment_total > 1 && entry.installment_current) {
      return `${String(entry.installment_current).padStart(2, "0")}/${String(entry.installment_total).padStart(2, "0")}`;
    }
    return "01/01";
  };
  const getCleanDescription = (desc: string) =>
    desc.replace(/\s*\b\d{1,2}\/\d{1,2}\b\s*/g, " ").replace(/\s+/g, " ").trim();

  const openAllocation = (entry: FinancialEntry) => {
    const existing = allocationsByEntry.get(entry.id);
    if (existing && existing.length > 0) {
      setAllocationRows(
        existing.map((row) => ({
          vehicleId: row.vehicle_id,
          amount: (row.amount_cents / 100).toFixed(2).replace(".", ","),
        }))
      );
    } else {
      setAllocationRows([
        {
          vehicleId: entry.vehicle_id || "",
          amount: (entry.amount_cents / 100).toFixed(2).replace(".", ","),
        },
      ]);
    }
    setAllocationEntry(entry);
  };

  const allocationTotalCents = allocationRows.reduce((sum, row) => {
    const parsed = Math.round(parseFloat(row.amount.replace(",", ".")) * 100);
    return sum + (Number.isNaN(parsed) ? 0 : parsed);
  }, 0);

  return (
    <MainLayout>
      <PageTransition>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Sa?das</h1>
            <p className="page-subtitle">Custos e despesas operacionais</p>
          </div>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Lan?amento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={entryType} onValueChange={(v) => {
                  setEntryType(v as "CUSTO" | "DESPESA");
                  setGroupId("");
                  setSubgroupId("");
                  setCostCenterId("");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTO">Custo Operacional</SelectItem>
                    <SelectItem value="DESPESA">Despesa Administrativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Veiculo {entryType === "CUSTO" ? "(obrigatorio)" : "(opcional)"}
                </Label>
                <Select
                  value={vehicleId || ""}
                  onValueChange={(value) => setVehicleId(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={entryType === "CUSTO" ? "Selecione o veiculo" : "Sem veiculo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {entryType !== "CUSTO" && (
                      <SelectItem value="__none__">Sem veiculo</SelectItem>
                    )}
                    {activeVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}{vehicle.plate ? ` - ${vehicle.plate}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {entryType === "CUSTO" && !vehicleId && (
                  <p className="text-xs text-muted-foreground">
                    Custos operacionais precisam de um veiculo vinculado.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

              {hasSubgroups ? (
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
              ) : (
                <div />
              )}
            </div>

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

            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div className="space-y-2">
              <Label>Descri??o</Label>
              <Textarea
                placeholder="Descri??o do lan?amento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div><Button
              className="w-full"
              onClick={() => createEntry.mutate()}
              disabled={
                !groupId ||
                (hasSubgroups && !subgroupId) ||
                !amount ||
                !description ||
                createEntry.isPending ||
                (entryType === "CUSTO" && !vehicleId)
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Lan?amento
            </Button>
          </CardContent>
        </Card>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="finance-card-negative">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Total Custos</p>
                    <p className="stat-value text-destructive">
                      {formatCurrency(totalCustos)}
                    </p>
                  </div>
                  <ArrowDownCircle className="h-10 w-10 text-destructive/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="finance-card-warning">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Total Despesas</p>
                    <p className="stat-value text-warning">
                      {formatCurrency(totalDespesas)}
                    </p>
                  </div>
                  <DollarSign className="h-10 w-10 text-warning/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Lan?amentos - {formatMonthRef(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : entries && entries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Descri??o</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.type === "CUSTO" ? "destructive" : "secondary"}>
                            {entry.type}
                          </Badge>
                          {(() => {
                            const allocation = allocationsByEntry.get(entry.id);
                            const vehicleIds = allocation?.length
                              ? allocation.map((row) => row.vehicle_id)
                              : entry.vehicle_id
                                ? [entry.vehicle_id]
                                : [];
                            if (vehicleIds.length === 0) return null;
                            const labels = vehicleIds
                              .map((id) => vehicleById.get(id))
                              .filter(Boolean)
                              .map((v) => `${v!.name}${v!.plate ? ` - ${v!.plate}` : ""}`);
                            if (labels.length === 0) return null;
                            return (
                              <div className="text-xs text-muted-foreground mt-1">
                                {labels.join(", ")}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {entry.category}
                          {entry.subcategory && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {entry.subcategory}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              entry.installment_total && entry.installment_total > 1
                                ? "border-sky-500/40 text-sky-600 bg-sky-500/5"
                                : "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                            )}
                          >
                            {getInstallmentLabel(entry)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {getCleanDescription(entry.description)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          -{formatCurrency(entry.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="group"
                              onClick={() => openAllocation(entry)}
                            >
                              <PieChart className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="group"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Excluir lancamento?</DialogTitle>
                                  <DialogDescription>
                                    Esta acao nao pode ser desfeita. O lancamento sera removido.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    onClick={() => deleteEntry.mutate(entry.id)}
                                  >
                                    Excluir
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lan?amento neste m?s
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog
        open={!!allocationEntry}
        onOpenChange={(open) => {
          if (!open) {
            setAllocationEntry(null);
            setAllocationRows([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rateio por veiculo</DialogTitle>
            <DialogDescription>
              Divida o valor do lancamento entre um ou mais veiculos.
            </DialogDescription>
          </DialogHeader>
          {allocationEntry && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{getCleanDescription(allocationEntry.description)}</div>
                  <div className="font-mono text-destructive">
                    -{formatCurrency(allocationEntry.amount_cents)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(allocationEntry.date)} ? {allocationEntry.category}
                </div>
              </div>
              <div className="space-y-3">
                {allocationRows.map((row, index) => (
                  <div key={`${row.vehicleId}-${index}`} className="grid gap-2 md:grid-cols-[2fr_1fr_40px] items-center">
                    <Select
                      value={row.vehicleId || ""}
                      onValueChange={(value) => {
                        setAllocationRows((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, vehicleId: value } : item))
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o veiculo" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}{vehicle.plate ? ` - ${vehicle.plate}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="0,00"
                      value={row.amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAllocationRows((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, amount: value } : item))
                        );
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="group"
                      onClick={() =>
                        setAllocationRows((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    setAllocationRows((prev) => [...prev, { vehicleId: "", amount: "" }])
                  }
                >
                  Adicionar veiculo
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total rateado</span>
                <span className={cn(
                  "font-mono",
                  allocationEntry.amount_cents === allocationTotalCents
                    ? "text-emerald-600"
                    : "text-amber-600"
                )}>
                  {formatCurrency(allocationTotalCents)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocationEntry(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveAllocations.mutate()} disabled={saveAllocations.isPending}>
              Salvar rateio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </PageTransition>
</MainLayout>
  );
}





