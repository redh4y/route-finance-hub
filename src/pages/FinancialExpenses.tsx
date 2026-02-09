import { useMemo, useState } from "react";
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


const COST_CATEGORIES = [
  {
    category: "Motoristas",
    subcategories: [
      "Sal?rio",
      "Di?rias",
      "Horas extras",
      "Encargos trabalhistas (INSS, FGTS)",
      "F?rias + 1/3",
      "13? sal?rio",
      "Rescis?es",
    ],
  },
  {
    category: "Combust?vel",
    subcategories: ["Diesel", "Aditivos", "ARLA 32"],
  },
  {
    category: "Manuten??o de Ve?culos",
    subcategories: [
      "Pe?as",
      "M?o de obra mec?nica",
      "Troca de ?leo",
      "Filtros",
      "Pneus",
      "Alinhamento e balanceamento",
      "Lavagem",
      "Manuten??o preventiva",
      "Manuten??o corretiva",
    ],
  },
  {
    category: "Documenta??o e Regulariza??o",
    subcategories: [
      "Licenciamento",
      "IPVA",
      "Vistoria",
      "ANTT / Artesp",
      "Tac?grafo (aferi??o)",
      "Seguro obrigat?rio",
    ],
  },
  {
    category: "Seguros",
    subcategories: [
      "Seguro do ve?culo",
      "Seguro de passageiros",
      "Seguro contra terceiros",
    ],
  },
  {
    category: "Deprecia??o",
    subcategories: [
      "Deprecia??o dos ?nibus",
      "Deprecia??o de equipamentos (ex: c?meras)",
    ],
  },
  {
    category: "Ped?gios",
    subcategories: ["Ped?gios fixos da rota", "Ped?gios eventuais"],
  },
];

const EXPENSE_CATEGORIES = [
  {
    category: "Administrativo",
    subcategories: [
      "Pr?-labore",
      "Sal?rio administrativo",
      "Encargos",
      "Contabilidade",
      "Honor?rios jur?dicos",
      "Sistema / Software",
      "Internet",
      "Energia el?trica",
      "Telefone",
    ],
  },
  {
    category: "Comercial",
    subcategories: ["Marketing", "Impulsionamento", "Designer", "Impressos"],
  },
  {
    category: "Financeiro",
    subcategories: [
      "Taxas banc?rias",
      "Juros",
      "Multas",
      "Tarifas de boleto / PIX",
      "Antecipa??o de receb?veis",
    ],
  },
  {
    category: "Estrutura F?sica",
    subcategories: ["Aluguel (se houver)", "IPTU", "?gua", "Manuten??o do escrit?rio"],
  },
  {
    category: "Outros",
    subcategories: ["Uniformes", "Treinamentos", "Multas de tr?nsito", "Brindes"],
  },
];

const COST_CATEGORY_SET = new Set(COST_CATEGORIES.map((item) => item.category));
const EXPENSE_CATEGORY_SET = new Set(EXPENSE_CATEGORIES.map((item) => item.category));
export default function FinancialExpenses() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [entryType, setEntryType] = useState<"CUSTO" | "DESPESA">("CUSTO");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
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
      if (entryType === "CUSTO" && !COST_CATEGORY_SET.has(category)) {
        throw new Error("Categoria invalida para CUSTO.");
      }
      if (entryType === "DESPESA" && !EXPENSE_CATEGORY_SET.has(category)) {
        throw new Error("Categoria invalida para DESPESA.");
      }
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      
      const { error } = await supabase.from("financial_entries").insert({
        competence_month: selectedMonth,
        date,
        type: entryType,
        category,
        subcategory: subcategory || null,
        description,
        amount_cents: amountCents,
        source: "MANUAL",
        vehicle_id: vehicleId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Lançamento criado com sucesso");
      // Reset form
      setCategory("");
      setSubcategory("");
      setDescription("");
      setAmount("");
      setVehicleId("");
    },
    onError: (error) => {
      toast.error("Erro ao criar lançamento: " + error.message);
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
      toast.success("Lançamento excluído");
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

  const categories = entryType === "CUSTO" ? COST_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategory = categories.find(
    (c) => c.category.toLowerCase() === category.toLowerCase().trim()
  );

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
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Saídas</h1>
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
              Novo Lançamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory("");
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.category} value={c.category}>
                        {c.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && selectedCategory.subcategories.length > 0 ? (
                <div className="space-y-2">
                  <Label>Subcategoria</Label>
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCategory.subcategories.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div />
              )}
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
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição do lançamento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div><Button
              className="w-full"
              onClick={() => createEntry.mutate()}
              disabled={
                !category ||
                !amount ||
                !description ||
                createEntry.isPending ||
                (entryType === "CUSTO" && !vehicleId)
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Lançamento
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
              <CardTitle>Lançamentos - {formatMonthRef(selectedMonth)}</CardTitle>
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
                      <TableHead>Categoria</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Descrição</TableHead>
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
                  Nenhum lançamento neste mês
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
                  {formatDate(allocationEntry.date)} • {allocationEntry.category}
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
    </MainLayout>
  );
}




