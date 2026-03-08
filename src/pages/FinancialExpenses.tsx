import { useEffect, useMemo, useState } from "react";
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
import {
  formatCurrency,
  formatDate,
  formatMonthRef,
  getCurrentMonthRef,
} from "@/lib/formatters";
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
import {
  ArrowDownCircle,
  Plus,
  DollarSign,
  Trash2,
  SlidersHorizontal,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Paperclip,
  ExternalLink,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  payment_method?: string | null;
  group_id?: string | null;
  subgroup_id?: string | null;
  needs_classification?: boolean | null;
  needs_review?: boolean | null;
  review_reasons?: string[] | null;
  attachment_url?: string | null;
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

type QuickFilter =
  | "ALL"
  | "REVIEW"
  | "NO_GROUP"
  | "COST_NO_VEHICLE"
  | "CUSTO"
  | "DESPESA";

const PAYMENT_METHOD_OPTIONS = [
  { value: "PIX", label: "PIX" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
  { value: "BOLETO", label: "Boleto" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "DEBITO_AUTOMATICO", label: "Débito automático" },
  { value: "OUTRO", label: "Outro" },
] as const;

const REVIEW_REASON_LABELS: Record<string, string> = {
  MISSING_GROUP: "Falta grupo DRE",
  MISSING_SUBGROUP: "Falta subgrupo DRE",
  COST_WITHOUT_VEHICLE: "Custo sem veículo",
  MISSING_PAYMENT_METHOD: "Falta forma de pagamento",
  INCONSISTENT_TYPE_GROUP: "Tipo inconsistente com grupo",
};

function formatReviewReasons(reasons?: string[] | null): string {
  if (!reasons || reasons.length === 0) return "";
  return reasons
    .map((reason) => REVIEW_REASON_LABELS[reason] || reason)
    .join(", ");
}

function isEntryNeedsReview(
  entry: FinancialEntry,
  allocationsByEntry: Map<string, AllocationRow[]>,
): boolean {
  if (entry.needs_review || entry.needs_classification) return true;
  if (!entry.group_id) return true;
  const allocation = allocationsByEntry.get(entry.id);
  const hasVehicle = (allocation?.length ?? 0) > 0 || !!entry.vehicle_id;
  if (entry.type === "CUSTO" && !hasVehicle) return true;
  return false;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

const QUICK_FILTERS: {
  value: QuickFilter;
  label: string;
  icon?: React.ReactNode;
}[] = [
  { value: "ALL", label: "Todos" },
  {
    value: "REVIEW",
    label: "Revisão",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  { value: "NO_GROUP", label: "Sem grupo" },
  { value: "COST_NO_VEHICLE", label: "Custo s/ veículo" },
  { value: "CUSTO", label: "Custos" },
  { value: "DESPESA", label: "Despesas" },
];

export default function FinancialExpenses() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const [entryType, setEntryType] = useState<"CUSTO" | "DESPESA">("CUSTO");
  const [groupId, setGroupId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [vehicleId, setVehicleId] = useState("");
  const [allocationEntry, setAllocationEntry] = useState<FinancialEntry | null>(
    null,
  );
  const [allocationRows, setAllocationRows] = useState<AllocationDraft[]>([]);
  const [classEntryType, setClassEntryType] = useState<"CUSTO" | "DESPESA">(
    "DESPESA",
  );
  const [classGroupId, setClassGroupId] = useState("");
  const [classSubgroupId, setClassSubgroupId] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [selectedMonth, quickFilter, paymentFilter, pageSize]);

  const uploadAttachment = async (entryId: string, file: File) => {
    setUploadingId(entryId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${entryId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("financial-attachments")
        .upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from("financial-attachments")
        .getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("financial_entries")
        .update({ attachment_url: urlData.publicUrl } as any)
        .eq("id", entryId);
      if (dbErr) throw dbErr;
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      toast.success("Comprovante anexado");
    } catch (err: any) {
      toast.error("Erro ao anexar: " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate, active")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        plate: string | null;
        active: boolean;
      }[];
    },
  });
  const activeVehicles = useMemo(
    () => (vehicles || []).filter((vehicle) => vehicle.active),
    [vehicles],
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

  const { data: classDreGroups } = useQuery({
    queryKey: ["dre-groups-classification", classEntryType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_groups")
        .select("id, name, nature")
        .eq("nature", classEntryType)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; nature: string }[];
    },
    enabled: !!allocationEntry,
  });

  const { data: classDreSubgroups } = useQuery({
    queryKey: ["dre-subgroups-classification", classGroupId],
    enabled: !!allocationEntry && !!classGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_subgroups")
        .select("id, name, group_id")
        .eq("group_id", classGroupId)
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
      return data as {
        id: string;
        name: string;
        type: string;
        active: boolean;
      }[];
    },
  });

  // All DRE groups for display (both CUSTO and DESPESA)
  const { data: allDreGroups } = useQuery({
    queryKey: ["dre-groups-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_groups")
        .select("id, name, nature")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; nature: string }[];
    },
  });

  const { data: allDreSubgroups } = useQuery({
    queryKey: ["dre-subgroups-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dre_subgroups")
        .select("id, name, group_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; group_id: string }[];
    },
  });

  const groupById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    (dreGroups || []).forEach((g) => map.set(g.id, { name: g.name }));
    return map;
  }, [dreGroups]);

  const allGroupById = useMemo(() => {
    const map = new Map<string, { name: string; nature: string }>();
    (allDreGroups || []).forEach((g) =>
      map.set(g.id, { name: g.name, nature: g.nature }),
    );
    return map;
  }, [allDreGroups]);

  const allSubgroupById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    (allDreSubgroups || []).forEach((sg) => map.set(sg.id, { name: sg.name }));
    return map;
  }, [allDreSubgroups]);

  const subgroupById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    (dreSubgroups || []).forEach((subgroup) => {
      map.set(subgroup.id, { name: subgroup.name });
    });
    return map;
  }, [dreSubgroups]);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: entriesResult, isLoading } = useQuery({
    queryKey: [
      "financial-entries",
      selectedMonth,
      "expenses",
      quickFilter,
      paymentFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      let query = supabase
        .from("financial_entries")
        .select("*", { count: "exact" })
        .or(
          `competence_month.eq.${selectedMonth},invoice_month.eq.${selectedMonth}`,
        )
        .in("type", ["CUSTO", "DESPESA"]);

      if (quickFilter === "CUSTO" || quickFilter === "DESPESA") {
        query = query.eq("type", quickFilter);
      } else if (quickFilter === "NO_GROUP") {
        query = query.is("group_id", null);
      } else if (quickFilter === "COST_NO_VEHICLE") {
        query = query.eq("type", "CUSTO").is("vehicle_id", null);
      } else if (quickFilter === "REVIEW") {
        query = query.or(
          "needs_review.eq.true,needs_classification.eq.true,group_id.is.null",
        );
      }

      if (paymentFilter !== "ALL") {
        query = query.eq("payment_method", paymentFilter);
      }

      const { data, error, count } = await query
        .order("date", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        rows: (data || []) as FinancialEntry[],
        count: count || 0,
      };
    },
  });

  const entries = entriesResult?.rows || [];
  const totalEntries = entriesResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  const { data: summaryRows } = useQuery({
    queryKey: ["financial-entries-summary", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("type, amount_cents")
        .or(
          `competence_month.eq.${selectedMonth},invoice_month.eq.${selectedMonth}`,
        )
        .in("type", ["CUSTO", "DESPESA"]);
      if (error) throw error;
      return (data || []) as Pick<FinancialEntry, "type" | "amount_cents">[];
    },
  });

  const { data: reviewCount = 0 } = useQuery({
    queryKey: ["financial-entries-review-count", selectedMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("financial_entries")
        .select("id", { count: "exact", head: true })
        .or(
          `competence_month.eq.${selectedMonth},invoice_month.eq.${selectedMonth}`,
        )
        .in("type", ["CUSTO", "DESPESA"])
        .or("needs_review.eq.true,needs_classification.eq.true,group_id.is.null");
      if (error) throw error;
      return count || 0;
    },
  });

  const entryIds = useMemo(() => entries.map((e) => e.id), [entries]);
  const { data: allocations } = useQuery({
    queryKey: ["financial-entry-allocations", selectedMonth, page, pageSize],
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

  const filteredEntries = entries;

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!groupId) {
        throw new Error("Selecione um grupo.");
      }
      if ((dreSubgroups?.length || 0) > 0 && !subgroupId) {
        throw new Error("Selecione um subgrupo.");
      }
      const amountCents = Math.round(
        parseFloat(amount.replace(",", ".")) * 100,
      );
      const group = groupById.get(groupId);
      const subgroup = subgroupId ? subgroupById.get(subgroupId) : null;
      const reviewReasons: string[] = [];
      if (!groupId) reviewReasons.push("MISSING_GROUP");
      if ((dreSubgroups?.length || 0) > 0 && !subgroupId)
        reviewReasons.push("MISSING_SUBGROUP");
      if (entryType === "CUSTO" && !vehicleId)
        reviewReasons.push("COST_WITHOUT_VEHICLE");
      if (!paymentMethod) reviewReasons.push("MISSING_PAYMENT_METHOD");
      const needsReview = reviewReasons.length > 0;

      const payload: any = {
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
        payment_method: paymentMethod || null,
        needs_review: needsReview,
        review_reasons: reviewReasons,
      };

      const { error } = await supabase
        .from("financial_entries")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Lançamento criado com sucesso");
      setGroupId("");
      setSubgroupId("");
      setCostCenterId("");
      setDescription("");
      setAmount("");
      setVehicleId("");
      setPaymentMethod("PIX");
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

  const clearAllEntries = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financial_entries")
        .delete()
        .in("type", ["CUSTO", "DESPESA"]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({
        queryKey: ["financial-entry-allocations"],
      });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Todos os lançamentos de saídas foram removidos");
    },
    onError: (error) => {
      toast.error("Erro ao limpar dados: " + error.message);
    },
  });

  const saveAllocations = useMutation({
    mutationFn: async () => {
      if (!allocationEntry) return;
      if (!classGroupId) {
        throw new Error("Selecione o grupo para classificar o lançamento.");
      }
      const hasClassSubgroups = (classDreSubgroups?.length || 0) > 0;
      if (hasClassSubgroups && !classSubgroupId) {
        throw new Error("Selecione o subgrupo para classificar o lançamento.");
      }
      const parsed = allocationRows
        .filter((row) => row.vehicleId && row.amount)
        .map((row) => ({
          vehicleId: row.vehicleId,
          amountCents: Math.round(
            parseFloat(row.amount.replace(",", ".")) * 100,
          ),
        }));

      if (
        parsed.some(
          (row) => Number.isNaN(row.amountCents) || row.amountCents <= 0,
        )
      ) {
        throw new Error("Preencha os valores de rateio corretamente.");
      }

      if (parsed.length > 0) {
        const total = parsed.reduce((sum, row) => sum + row.amountCents, 0);
        if (total !== allocationEntry.amount_cents) {
          throw new Error(
            "A soma do rateio deve ser igual ao valor do lançamento.",
          );
        }
      }

      const { error: deleteError } = await supabase
        .from("financial_entry_allocations")
        .delete()
        .eq("entry_id", allocationEntry.id);
      if (deleteError) throw deleteError;

      if (parsed.length > 0) {
        const { error: insertError } = await supabase
          .from("financial_entry_allocations")
          .insert(
            parsed.map((row) => ({
              entry_id: allocationEntry.id,
              vehicle_id: row.vehicleId,
              amount_cents: row.amountCents,
            })),
          );
        if (insertError) throw insertError;
      }

      const selectedGroup = classDreGroups?.find((g) => g.id === classGroupId);
      const selectedSubgroup = classDreSubgroups?.find(
        (sg) => sg.id === classSubgroupId,
      );
      const reviewReasons: string[] = [];
      if (!classGroupId) reviewReasons.push("MISSING_GROUP");
      if (hasClassSubgroups && !classSubgroupId)
        reviewReasons.push("MISSING_SUBGROUP");
      if (classEntryType === "CUSTO" && parsed.length === 0)
        reviewReasons.push("COST_WITHOUT_VEHICLE");
      const needsReview = reviewReasons.length > 0;

      const updatePayload: any = {
        vehicle_id: null,
        type: classEntryType,
        group_id: classGroupId,
        subgroup_id: classSubgroupId || null,
        category: selectedGroup?.name || allocationEntry.category,
        subcategory: selectedSubgroup?.name || null,
        needs_classification: false,
        needs_review: needsReview,
        review_reasons: reviewReasons,
      };

      const { error: updateError } = await supabase
        .from("financial_entries")
        .update(updatePayload)
        .eq("id", allocationEntry.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["financial-entry-allocations"],
      });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Classificação e rateio salvos com sucesso");
      setAllocationEntry(null);
      setAllocationRows([]);
      setClassGroupId("");
      setClassSubgroupId("");
    },
    onError: (error) => {
      toast.error("Erro ao salvar classificação: " + error.message);
    },
  });
  const hasSubgroups = (dreSubgroups?.length || 0) > 0;

  const totalCustos =
    summaryRows
      ?.filter((e) => e.type === "CUSTO")
      .reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const totalDespesas =
    summaryRows
      ?.filter((e) => e.type === "DESPESA")
      .reduce((sum, e) => sum + e.amount_cents, 0) || 0;
  const getInstallmentLabel = (entry: FinancialEntry) => {
    if (
      entry.installment_total &&
      entry.installment_total > 1 &&
      entry.installment_current
    ) {
      return `${String(entry.installment_current).padStart(2, "0")}/${String(entry.installment_total).padStart(2, "0")}`;
    }
    return "01/01";
  };
  const getCleanDescription = (desc: string) =>
    desc
      .replace(/\s*\b\d{1,2}\/\d{1,2}\b\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const openAllocation = (entry: FinancialEntry) => {
    const existing = allocationsByEntry.get(entry.id);
    if (existing && existing.length > 0) {
      setAllocationRows(
        existing.map((row) => ({
          vehicleId: row.vehicle_id,
          amount: (row.amount_cents / 100).toFixed(2).replace(".", ","),
        })),
      );
    } else {
      setAllocationRows([
        {
          vehicleId: entry.vehicle_id || "",
          amount: (entry.amount_cents / 100).toFixed(2).replace(".", ","),
        },
      ]);
    }
    const normalizedType = entry.type === "CUSTO" ? "CUSTO" : "DESPESA";
    setClassEntryType(normalizedType);
    setClassGroupId(entry.group_id || "");
    setClassSubgroupId(entry.subgroup_id || "");
    setAllocationEntry(entry);
  };

  const allocationTotalCents = allocationRows.reduce((sum, row) => {
    const parsed = Math.round(parseFloat(row.amount.replace(",", ".")) * 100);
    return sum + (Number.isNaN(parsed) ? 0 : parsed);
  }, 0);
  const allocationRemainingCents = allocationEntry
    ? allocationEntry.amount_cents - allocationTotalCents
    : 0;

  return (
    <MainLayout>
      <PageTransition>
        <TooltipProvider>
          <div className="page-header">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="page-title">Saídas</h1>
                <p className="page-subtitle">Custos e despesas operacionais</p>
              </div>
              <div className="flex items-center gap-3">
                {reviewCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-review/30 text-review hover:bg-review/10"
                    onClick={() => setQuickFilter("REVIEW")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1.5" />
                    {reviewCount} pendência{reviewCount > 1 ? "s" : ""}
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      LIMPAR TODOS OS DADOS
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Limpar todos os dados de saídas?
                      </DialogTitle>
                      <DialogDescription>
                        Esta ação remove todos os lançamentos de custos e
                        despesas. Não pode ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="destructive"
                          onClick={() => clearAllEntries.mutate()}
                          disabled={clearAllEntries.isPending}
                        >
                          Confirmar limpeza
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-[180px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth(getCurrentMonthRef())}
                >
                  Mês atual
                </Button>
              </div>
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
                    <Label>Tipo</Label>
                    <Select
                      value={entryType}
                      onValueChange={(v) => {
                        setEntryType(v as "CUSTO" | "DESPESA");
                        setGroupId("");
                        setSubgroupId("");
                        setCostCenterId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTO">Custo Operacional</SelectItem>
                        <SelectItem value="DESPESA">
                          Despesa Administrativa
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Veículo {entryType === "CUSTO" ? "" : "(opcional)"}
                    </Label>
                    <Select
                      value={vehicleId || ""}
                      onValueChange={(value) =>
                        setVehicleId(value === "__none__" ? "" : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            entryType === "CUSTO"
                              ? "Selecione o veículo"
                              : "Sem veículo"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem veículo</SelectItem>
                        {activeVehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}
                            {vehicle.plate ? ` - ${vehicle.plate}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entryType === "CUSTO" && !vehicleId && (
                      <p className="text-xs text-warning flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Custo sem veículo — ficará em revisão
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select
                      value={groupId}
                      onValueChange={(v) => {
                        setGroupId(v);
                        setSubgroupId("");
                      }}
                    >
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
                    onValueChange={(value) =>
                      setCostCenterId(value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        Sem centro de custo
                      </SelectItem>
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
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
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
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  disabled={
                    !groupId ||
                    (hasSubgroups && !subgroupId) ||
                    !amount ||
                    !description ||
                    createEntry.isPending
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
              <div className="grid gap-4 md:grid-cols-3">
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
                <Card
                  className={cn(
                    "border-l-4",
                    reviewCount > 0 ? "border-l-review" : "border-l-success",
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="stat-label">Pendências</p>
                        <p
                          className={cn(
                            "stat-value",
                            reviewCount > 0 ? "text-review" : "text-success",
                          )}
                        >
                          {reviewCount}
                        </p>
                      </div>
                      {reviewCount > 0 ? (
                        <AlertTriangle className="h-10 w-10 text-review/20" />
                      ) : (
                        <CheckCircle2 className="h-10 w-10 text-success/20" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    {QUICK_FILTERS.map((f) => (
                      <Button
                        key={f.value}
                        variant={
                          quickFilter === f.value ? "default" : "outline"
                        }
                        size="sm"
                        className={cn(
                          "h-8 text-xs",
                          quickFilter === f.value &&
                            f.value === "REVIEW" &&
                            "bg-review hover:bg-review/90",
                        )}
                        onClick={() => setQuickFilter(f.value)}
                      >
                        {f.icon && <span className="mr-1">{f.icon}</span>}
                        {f.label}
                        {f.value === "REVIEW" && reviewCount > 0 && (
                          <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">
                            {reviewCount}
                          </span>
                        )}
                      </Button>
                    ))}
                    <div className="ml-auto">
                      <Select
                        value={paymentFilter}
                        onValueChange={setPaymentFilter}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                          <SelectValue placeholder="Pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todos pagamentos</SelectItem>
                          {PAYMENT_METHOD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Lançamentos — {formatMonthRef(selectedMonth)}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {filteredEntries.length} de {totalEntries}{" "}
                      lançamentos
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : filteredEntries.length > 0 ? (
                    <>
                      {/* Mobile: Card list */}
                      <div className="lg:hidden space-y-3">
                        {filteredEntries.map((entry) => {
                          const needsReview = isEntryNeedsReview(
                            entry,
                            allocationsByEntry,
                          );
                          const groupInfo = entry.group_id
                            ? allGroupById.get(entry.group_id)
                            : null;
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                "p-3 rounded-lg border bg-card space-y-2",
                                needsReview &&
                                  "border-review/30 bg-review/[0.03]",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[11px] font-semibold shrink-0",
                                      entry.type === "CUSTO"
                                        ? "border-destructive/40 text-destructive bg-destructive/5"
                                        : "border-warning/40 text-warning bg-warning/5",
                                    )}
                                  >
                                    {entry.type}
                                  </Badge>
                                  {needsReview && (
                                    <AlertTriangle className="h-3.5 w-3.5 text-review shrink-0" />
                                  )}
                                </div>
                                <span className="font-mono text-sm text-destructive font-medium shrink-0">
                                  -{formatCurrency(entry.amount_cents)}
                                </span>
                              </div>
                              <p className="text-sm truncate">
                                {getCleanDescription(entry.description)}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDate(entry.date)}</span>
                                <span>·</span>
                                <span>{groupInfo?.name || "Sem grupo"}</span>
                                <span>·</span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {PAYMENT_METHOD_OPTIONS.find(
                                    (o) => o.value === entry.payment_method,
                                  )?.label ||
                                    entry.payment_method ||
                                    "—"}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    entry.installment_total &&
                                      entry.installment_total > 1
                                      ? "border-accent/40 text-accent"
                                      : "border-success/40 text-success",
                                  )}
                                >
                                  {getInstallmentLabel(entry)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => openAllocation(entry)}
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                                  Classificar
                                </Button>
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) uploadAttachment(entry.id, f);
                                    }}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs pointer-events-none"
                                    tabIndex={-1}
                                  >
                                    <Paperclip className="h-3.5 w-3.5 mr-1" />
                                    {entry.attachment_url ? "Trocar" : "Anexar"}
                                  </Button>
                                </label>
                                {entry.attachment_url && (
                                  <a
                                    href={entry.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                      Ver
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop: Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[90px]">Data</TableHead>
                              <TableHead className="w-[120px]">Tipo</TableHead>
                              <TableHead>Grupo / Subgrupo</TableHead>
                              <TableHead className="w-[70px]">Parc.</TableHead>
                              <TableHead className="w-[120px]">
                                Pagamento
                              </TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-right w-[110px]">
                                Valor
                              </TableHead>
                              <TableHead className="w-[110px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEntries.map((entry) => {
                              const needsReview = isEntryNeedsReview(
                                entry,
                                allocationsByEntry,
                              );
                              const allocation = allocationsByEntry.get(
                                entry.id,
                              );
                              const vehicleIds = allocation?.length
                                ? allocation.map((row) => row.vehicle_id)
                                : entry.vehicle_id
                                  ? [entry.vehicle_id]
                                  : [];
                              const groupInfo = entry.group_id
                                ? allGroupById.get(entry.group_id)
                                : null;
                              const subgroupInfo = entry.subgroup_id
                                ? allSubgroupById.get(entry.subgroup_id)
                                : null;

                              return (
                                <TableRow
                                  key={entry.id}
                                  className={cn(
                                    needsReview && "bg-review/[0.03]",
                                  )}
                                >
                                  <TableCell className="text-xs tabular-nums">
                                    {formatDate(entry.date)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[11px] font-semibold",
                                          entry.type === "CUSTO"
                                            ? "border-destructive/40 text-destructive bg-destructive/5"
                                            : "border-warning/40 text-warning bg-warning/5",
                                        )}
                                      >
                                        {entry.type}
                                      </Badge>
                                      {needsReview && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertTriangle className="h-3.5 w-3.5 text-review shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent
                                            side="top"
                                            className="max-w-[220px]"
                                          >
                                            <p className="font-medium text-xs mb-1">
                                              Pendências:
                                            </p>
                                            <p className="text-xs">
                                              {formatReviewReasons(
                                                entry.review_reasons,
                                              ) || "Classificação incompleta"}
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    {vehicleIds.length > 0 && (
                                      <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-[120px]">
                                        {vehicleIds
                                          .map((id) => vehicleById.get(id))
                                          .filter(Boolean)
                                          .map((v) => v!.name)
                                          .join(", ")}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5">
                                      {groupInfo ? (
                                        <span className="text-sm font-medium">
                                          {groupInfo.name}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground italic">
                                          Sem grupo
                                        </span>
                                      )}
                                      {subgroupInfo && (
                                        <div className="text-xs text-muted-foreground">
                                          {subgroupInfo.name}
                                        </div>
                                      )}
                                      {needsReview && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] border-review/30 text-review bg-review/5 mt-0.5"
                                        >
                                          Revisão DRE
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        entry.installment_total &&
                                          entry.installment_total > 1
                                          ? "border-accent/40 text-accent bg-accent/5"
                                          : "border-success/40 text-success bg-success/5",
                                      )}
                                    >
                                      {getInstallmentLabel(entry)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {PAYMENT_METHOD_OPTIONS.find(
                                        (o) => o.value === entry.payment_method,
                                      )?.label ||
                                        entry.payment_method ||
                                        "—"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <span className="truncate block text-sm">
                                      {getCleanDescription(entry.description)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm text-destructive font-medium">
                                    -{formatCurrency(entry.amount_cents)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-end gap-0.5">
                                      {entry.attachment_url ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <a
                                              href={entry.attachment_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-success hover:bg-accent hover:text-accent-foreground"
                                              >
                                                <Paperclip className="h-4 w-4" />
                                              </Button>
                                            </a>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Ver comprovante
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <label className="cursor-pointer">
                                              <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                className="hidden"
                                                onChange={(e) => {
                                                  const f = e.target.files?.[0];
                                                  if (f)
                                                    uploadAttachment(
                                                      entry.id,
                                                      f,
                                                    );
                                                }}
                                              />
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                  "h-8 w-8 hover:bg-accent hover:text-accent-foreground",
                                                  uploadingId === entry.id &&
                                                    "animate-pulse",
                                                )}
                                                tabIndex={-1}
                                              >
                                                <Paperclip className="h-4 w-4" />
                                              </Button>
                                            </label>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Anexar comprovante
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                                            onClick={() =>
                                              openAllocation(entry)
                                            }
                                          >
                                            <SlidersHorizontal className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Classificar
                                        </TooltipContent>
                                      </Tooltip>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>
                                              Excluir lançamento?
                                            </DialogTitle>
                                            <DialogDescription>
                                              Esta ação não pode ser desfeita.
                                            </DialogDescription>
                                          </DialogHeader>
                                          <DialogFooter>
                                            <DialogClose asChild>
                                              <Button variant="outline">
                                                Cancelar
                                              </Button>
                                            </DialogClose>
                                            <Button
                                              variant="destructive"
                                              onClick={() =>
                                                deleteEntry.mutate(entry.id)
                                              }
                                            >
                                              Excluir
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-muted-foreground mb-2">
                        {quickFilter !== "ALL" || paymentFilter !== "ALL"
                          ? "Nenhum lançamento encontrado com os filtros aplicados"
                          : "Nenhum lançamento neste mês"}
                      </div>
                      {(quickFilter !== "ALL" || paymentFilter !== "ALL") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuickFilter("ALL");
                            setPaymentFilter("ALL");
                          }}
                        >
                          Limpar filtros
                        </Button>
                      )}
                    </div>
                  )}

                  {totalEntries > 0 && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-muted-foreground">
                        Página {page} de {totalPages} • {totalEntries} lançamentos
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={String(pageSize)}
                          onValueChange={(v) => {
                            setPageSize(Number(v));
                            setPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <SelectItem key={size} value={String(size)}>
                                {size}/página
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Pr?xima
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Classification Modal */}
          <Dialog
            open={!!allocationEntry}
            onOpenChange={(open) => {
              if (!open) {
                setAllocationEntry(null);
                setAllocationRows([]);
                setClassGroupId("");
                setClassSubgroupId("");
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Classificar lançamento</DialogTitle>
                <DialogDescription>
                  Defina tipo, grupo, subgrupo e rateio por veículo.
                </DialogDescription>
              </DialogHeader>
              {allocationEntry && (
                <div className="space-y-5">
                  {/* Entry summary */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">
                          {getCleanDescription(allocationEntry.description)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(allocationEntry.date)} ·{" "}
                          {allocationEntry.category}
                          {allocationEntry.subcategory &&
                            ` / ${allocationEntry.subcategory}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold text-destructive">
                          -{formatCurrency(allocationEntry.amount_cents)}
                        </div>
                      </div>
                    </div>
                    {allocationEntry.review_reasons &&
                      allocationEntry.review_reasons.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {allocationEntry.review_reasons.map((reason) => (
                            <Badge
                              key={reason}
                              variant="outline"
                              className="text-[10px] border-review/30 text-review bg-review/5"
                            >
                              {REVIEW_REASON_LABELS[reason] || reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Classification fields */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={classEntryType}
                        onValueChange={(value) => {
                          setClassEntryType(value as "CUSTO" | "DESPESA");
                          setClassGroupId("");
                          setClassSubgroupId("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CUSTO">Custo</SelectItem>
                          <SelectItem value="DESPESA">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Grupo</Label>
                      <Select
                        value={classGroupId}
                        onValueChange={(value) => {
                          setClassGroupId(value);
                          setClassSubgroupId("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {classDreGroups?.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subgrupo</Label>
                      <Select
                        value={classSubgroupId || ""}
                        onValueChange={setClassSubgroupId}
                        disabled={
                          !classGroupId ||
                          (classDreSubgroups?.length || 0) === 0
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              (classDreSubgroups?.length || 0) === 0
                                ? "Sem subgrupo"
                                : "Selecione..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {classDreSubgroups?.map((subgroup) => (
                            <SelectItem key={subgroup.id} value={subgroup.id}>
                              {subgroup.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Vehicle allocation */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Rateio por veículo
                    </Label>
                    {allocationRows.map((row, index) => (
                      <div
                        key={`${row.vehicleId}-${index}`}
                        className="grid gap-2 md:grid-cols-[2fr_1fr_40px] items-center"
                      >
                        <Select
                          value={row.vehicleId || ""}
                          onValueChange={(value) => {
                            setAllocationRows((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? { ...item, vehicleId: value }
                                  : item,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o veículo" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles?.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                {vehicle.name}
                                {vehicle.plate ? ` - ${vehicle.plate}` : ""}
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
                              prev.map((item, i) =>
                                i === index ? { ...item, amount: value } : item,
                              ),
                            );
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() =>
                            setAllocationRows((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAllocationRows((prev) => [
                          ...prev,
                          { vehicleId: "", amount: "" },
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar veículo
                    </Button>
                  </div>

                  {/* Rateio summary */}
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total do lançamento
                      </span>
                      <span className="font-mono font-medium">
                        {formatCurrency(allocationEntry.amount_cents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total rateado
                      </span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          allocationEntry.amount_cents === allocationTotalCents
                            ? "text-success"
                            : "text-warning",
                        )}
                      >
                        {formatCurrency(allocationTotalCents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-1.5">
                      <span className="text-muted-foreground font-medium">
                        {allocationRemainingCents > 0
                          ? "Falta ratear"
                          : allocationRemainingCents < 0
                            ? "Excedente"
                            : "Rateio completo"}
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold",
                          allocationRemainingCents === 0
                            ? "text-success"
                            : allocationRemainingCents > 0
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {allocationRemainingCents === 0 ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            OK
                          </span>
                        ) : (
                          formatCurrency(Math.abs(allocationRemainingCents))
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAllocationEntry(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => saveAllocations.mutate()}
                  disabled={saveAllocations.isPending}
                >
                  Salvar classificação
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </PageTransition>
    </MainLayout>
  );
}
