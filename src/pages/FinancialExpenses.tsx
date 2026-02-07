import { useState } from "react";
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
import { ArrowDownCircle, Plus, DollarSign, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FinancialEntry {
  id: string;
  competence_month: string;
  date: string;
  type: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount_cents: number;
  source: string;
  created_at: string;
}

const COST_CATEGORIES = [
  { category: "Combustível", subcategories: [] },
  { category: "Manutenção", subcategories: ["Preventiva", "Corretiva"] },
  { category: "Pneus", subcategories: [] },
  { category: "Pedágio", subcategories: [] },
  { category: "Motoristas", subcategories: ["Salários", "Encargos"] },
  { category: "Seguro Veículos", subcategories: [] },
  { category: "Licenciamento", subcategories: [] },
];

const EXPENSE_CATEGORIES = [
  { category: "Pro-labore", subcategories: [] },
  { category: "Internet", subcategories: [] },
  { category: "Sistemas", subcategories: [] },
  { category: "Marketing", subcategories: [] },
  { category: "Contabilidade", subcategories: [] },
  { category: "Aluguel", subcategories: [] },
  { category: "Telefone", subcategories: [] },
  { category: "Material de Escritório", subcategories: [] },
];

export default function FinancialExpenses() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [entryType, setEntryType] = useState<"CUSTO" | "DESPESA">("CUSTO");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["financial-entries", selectedMonth, "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("competence_month", selectedMonth)
        .in("type", ["CUSTO", "DESPESA"])
        .order("date", { ascending: false });

      if (error) throw error;
      return data as FinancialEntry[];
    },
  });

  const createEntry = useMutation({
    mutationFn: async () => {
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

  const categories = entryType === "CUSTO" ? COST_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategory = categories.find((c) => c.category === category);

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const totalCustos = entries?.filter((e) => e.type === "CUSTO").reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const totalDespesas = entries?.filter((e) => e.type === "DESPESA").reduce((sum, e) => sum + e.amount_cents, 0) || 0;

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
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={entryType} onValueChange={(v) => {
                setEntryType(v as "CUSTO" | "DESPESA");
                setCategory("");
                setSubcategory("");
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

            {selectedCategory && selectedCategory.subcategories.length > 0 && (
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
            )}

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
                placeholder="Descrição do lançamento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createEntry.mutate()}
              disabled={!category || !amount || !description || createEntry.isPending}
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
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
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
                        </TableCell>
                        <TableCell>
                          {entry.category}
                          {entry.subcategory && (
                            <span className="text-muted-foreground"> / {entry.subcategory}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          -{formatCurrency(entry.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEntry.mutate(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
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
    </MainLayout>
  );
}
