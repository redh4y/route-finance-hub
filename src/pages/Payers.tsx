import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePayers, usePayersStats, usePayerById, Payer } from "@/hooks/usePayers";
import { supabase } from "@/integrations/supabase/client";
import { PayerDetailsModal } from "@/components/payers/PayerDetailsModal";
import { PageTransition } from "@/components/ui/page-transition";
import { formatCPF, formatPhone, formatCurrency } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Users,
  AlertCircle,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Edit,
  Plus,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Quick filter buttons
const QUICK_FILTERS = [
  { key: "all", label: "Todos", icon: Users },
  { key: "active", label: "Ativos", icon: UserCheck },
  { key: "inactive", label: "Inativos", icon: UserX },
  { key: "review", label: "Revis\u00e3o", icon: AlertTriangle },
  { key: "uncatalogued", label: "Sem cadastro", icon: AlertCircle },
] as const;

type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

const IMPORT_MISSING_PAYER_REASON = "IMPORT_BILLING_SEM_CADASTRO";

function isImportedWithoutRegister(
  reviewReason: string | null | undefined,
): boolean {
  return reviewReason === IMPORT_MISSING_PAYER_REASON;
}

export default function Payers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("active");
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [editPayerId, setEditPayerId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPayer, setNewPayer] = useState({
    name: "",
    document: "",
    phone: "",
    neighborhood: "",
    billingMode: "BOLETO",
    status: "ATIVO",
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  // Build filters based on quick filter
  const filters = useMemo(() => {
    switch (quickFilter) {
      case "active":
        return { status: "ATIVO" };
      case "inactive":
        return { status: "INATIVO" };
      case "review":
        return { needsReview: true };
      case "uncatalogued":
        return { reviewReason: IMPORT_MISSING_PAYER_REASON };
      default:
        return {};
    }
  }, [quickFilter]);

  useEffect(() => {
    setPage(1);
  }, [quickFilter, searchTerm]);

  const {
    data: payersResult,
    isLoading,
    error,
  } = usePayers({
    ...filters,
    search: searchTerm || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const payers = payersResult?.rows || [];
  const totalCount = payersResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Stats from separate lightweight query
  const { data: stats = { total: 0, active: 0, inactive: 0, review: 0, uncatalogued: 0 } } = usePayersStats();

  const clearSearch = () => {
    setSearchTerm("");
  };


  const resetNewPayer = () => {
    setNewPayer({
      name: "",
      document: "",
      phone: "",
      neighborhood: "",
      billingMode: "BOLETO",
      status: "ATIVO",
    });
  };

  const handleCreatePayer = async () => {
    const name = newPayer.name.trim();
    if (!name) {
      toast.error("Informe o nome do pagador.");
      return;
    }

    const documentDigits = newPayer.document.replace(/\D/g, "");
    const phoneDigits = newPayer.phone.replace(/\D/g, "");

    setIsCreating(true);
    try {
      const insertPayload = {
        id: crypto.randomUUID(),
        legacy_id: crypto.randomUUID(),
        name,
        document: newPayer.document.trim() || null,
        document_digits: documentDigits || null,
        document_valid: documentDigits.length === 11 ? true : null,
        phone: phoneDigits || null,
        neighborhood: newPayer.neighborhood.trim() || null,
        billing_mode: newPayer.billingMode,
        status: newPayer.status,
        needs_review: false,
        birth_date: null,
      };

      const { error } = await supabase.from("payers").insert([insertPayload]);
      if (error) throw error;

      toast.success("Pagador criado com sucesso.");
      setIsCreateOpen(false);
      resetNewPayer();
      queryClient.invalidateQueries({ queryKey: ["payers"] });
    } catch (error: any) {
      toast.error(`Erro ao criar pagador: ${error?.message || "falha desconhecida"}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pagadores</h1>
              <p className="text-muted-foreground text-sm">
                Gerencie alunos, cobranças e cadastros
              </p>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Novo pagador
              </Button>
              <StatPill icon={Users} label="Total" value={stats.total} />
              <StatPill
                icon={CheckCircle2}
                label="Ativos"
                value={stats.active}
                variant="success"
              />
              {stats.review > 0 && (
                <StatPill
                  icon={AlertTriangle}
                  label="Revisão"
                  value={stats.review}
                  variant="warning"
                />
              )}
              {stats.uncatalogued > 0 && (
                <StatPill
                  icon={AlertCircle}
                  label="Sem cadastro"
                  value={stats.uncatalogued}
                  variant="warning"
                />
              )}
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Quick filters */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
              {QUICK_FILTERS.map((filter) => {
                const isSelected = quickFilter === filter.key;
                const iconColorClasses =
                  filter.key === "all"
                    ? "text-sky-600"
                    : filter.key === "active"
                      ? "text-emerald-600"
                      : filter.key === "inactive"
                        ? "text-red-600"
                        : filter.key === "review"
                          ? "text-violet-600"
                          : filter.key === "uncatalogued"
                            ? "text-amber-600"
                            : "text-foreground";

                return (
                  <Button
                    key={filter.key}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setQuickFilter(filter.key)}
                    className={cn("gap-1.5 text-xs", isSelected && "shadow-sm")}
                  >
                    <filter.icon
                      className={cn("h-3.5 w-3.5", iconColorClasses)}
                    />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                Erro ao carregar pagadores: {error.message}
              </p>
            </motion.div>
          )}

          {/* Main content */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Payers list */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-280px)]">
                  {isLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : payers.length > 0 ? (
                    <>
                      {/* Mobile: Card list */}
                      <div className="lg:hidden p-3 space-y-3">
                        {payers.map((payer) => (
                          <PayerCard
                            key={payer.id}
                            payer={payer}
                            isSelected={selectedPayerId === payer.id}
                            onClick={() => setSelectedPayerId(payer.id)}
                            onEdit={() => setEditPayerId(payer.id)}
                          />
                        ))}
                      </div>

                      {/* Desktop: Table */}
                      <div className="hidden lg:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Pagador</TableHead>
                              <TableHead className="text-center">
                                Modo de cobrança
                              </TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">
                                Ações
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payers.map((payer) => (
                              <PayerRow
                                key={payer.id}
                                payer={payer}
                                isSelected={selectedPayerId === payer.id}
                                onClick={() => setSelectedPayerId(payer.id)}
                                onEdit={() => setEditPayerId(payer.id)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      searchTerm={searchTerm}
                      quickFilter={quickFilter}
                    />
                  )}
                </ScrollArea>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(1)}
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        ‹
                      </Button>
                      {(() => {
                        const pages: (number | string)[] = [];
                        const maxVisible = 5;
                        let start = Math.max(1, page - Math.floor(maxVisible / 2));
                        let end = Math.min(totalPages, start + maxVisible - 1);
                        if (end - start + 1 < maxVisible) {
                          start = Math.max(1, end - maxVisible + 1);
                        }
                        if (start > 1) {
                          pages.push(1);
                          if (start > 2) pages.push("...");
                        }
                        for (let i = start; i <= end; i++) {
                          if (i !== 1 && i !== totalPages) pages.push(i);
                          else if (!pages.includes(i)) pages.push(i);
                        }
                        if (end < totalPages) {
                          if (end < totalPages - 1) pages.push("...");
                          if (!pages.includes(totalPages)) pages.push(totalPages);
                        }
                        return pages.map((p, idx) =>
                          typeof p === "string" ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">…</span>
                          ) : (
                            <Button
                              key={p}
                              variant={p === page ? "default" : "outline"}
                              size="sm"
                              className="min-w-[2rem]"
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </Button>
                          )
                        );
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(totalPages)}
                      >
                        »
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Quick view panel - desktop only */}
            <div className="hidden lg:block">
              <QuickViewPanel payerId={selectedPayerId} />
            </div>
          </div>

          {/* Mobile: Quick view as sheet */}
          {isMobile && (
            <Sheet
              open={!!selectedPayerId}
              onOpenChange={(open) => !open && setSelectedPayerId(null)}
            >
              <SheetContent side="bottom" className="h-[70vh] p-0">
                <ScrollArea className="h-full">
                  <QuickViewPanel payerId={selectedPayerId} />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <PayerDetailsModal
          payerId={editPayerId}
          onClose={() => setEditPayerId(null)}
        />

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetNewPayer();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo pagador</DialogTitle>
              <DialogDescription>
                Cadastre manualmente um pagador.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-payer-name">Nome</Label>
                <Input
                  id="new-payer-name"
                  value={newPayer.name}
                  onChange={(e) =>
                    setNewPayer((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nome completo"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-payer-document">CPF</Label>
                  <Input
                    id="new-payer-document"
                    value={newPayer.document}
                    onChange={(e) =>
                      setNewPayer((prev) => ({ ...prev, document: e.target.value }))
                    }
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-payer-phone">Telefone</Label>
                  <Input
                    id="new-payer-phone"
                    value={newPayer.phone}
                    onChange={(e) =>
                      setNewPayer((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-payer-neighborhood">Bairro</Label>
                <Input
                  id="new-payer-neighborhood"
                  value={newPayer.neighborhood}
                  onChange={(e) =>
                    setNewPayer((prev) => ({ ...prev, neighborhood: e.target.value }))
                  }
                  placeholder="Bairro"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-payer-billing-mode">Modo de cobranca</Label>
                  <select
                    id="new-payer-billing-mode"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={newPayer.billingMode}
                    onChange={(e) =>
                      setNewPayer((prev) => ({ ...prev, billingMode: e.target.value }))
                    }
                  >
                    <option value="BOLETO">BOLETO</option>
                    <option value="PIX_ONLY">PIX_ONLY</option>
                    <option value="MIXED">MIXED</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-payer-status">Status</Label>
                  <select
                    id="new-payer-status"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={newPayer.status}
                    onChange={(e) =>
                      setNewPayer((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreatePayer} disabled={isCreating}>
                {isCreating ? "Salvando..." : "Adicionar pagador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}

// Stat pill component
function StatPill({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant?: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        {
          "bg-muted text-muted-foreground": variant === "default",
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400":
            variant === "success",
          "bg-amber-500/10 text-amber-600 dark:text-amber-400":
            variant === "warning",
        },
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{value}</span>
      <span className="hidden sm:inline text-muted-foreground">{label}</span>
    </div>
  );
}

// Payer row component
function PayerRow({
  payer,
  isSelected,
  onClick,
  onEdit,
}: {
  payer: Payer;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  if (!payer) return null;

  const isActive = payer.status === "ATIVO";

  return (
    <TableRow
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/50",
        isSelected && "bg-primary/5",
      )}
    >
      <TableCell>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-semibold",
              isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {payer.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{payer.name}</span>
              {payer.is_coordinator && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  Coord
                </Badge>
              )}
              {payer.needs_review && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 shrink-0 border-amber-500/50 text-amber-600"
                >
                  Revis\u00e3o
                </Badge>
              )}
              {isImportedWithoutRegister(payer.review_reason) && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 shrink-0 border-orange-500/50 text-orange-600"
                >
                  Sem cadastro
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="font-mono">
                {payer.document_digits
                  ? formatCPF(payer.document_digits)
                  : payer.payer_code || "-"}
              </span>
              {payer.neighborhood && (
                <>
                  <span className="text-muted-foreground/50">{"\u2022"}</span>
                  <span className="truncate">{payer.neighborhood}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={cn("text-xs", {
            "border-emerald-500/40 text-emerald-600 bg-emerald-500/5":
              payer.billing_mode === "PIX_ONLY",
            "border-amber-500/40 text-amber-600 bg-amber-500/5":
              payer.billing_mode === "MIXED",
            "border-sky-500/40 text-sky-600 bg-sky-500/5":
              payer.billing_mode === "BOLETO",
          })}
        >
          {payer.billing_mode}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isActive &&
              "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
          )}
        >
          {isActive ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Mobile card component for payers
function PayerCard({
  payer,
  isSelected,
  onClick,
  onEdit,
}: {
  payer: Payer;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  if (!payer) return null;

  const isActive = payer.status === "ATIVO";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-lg border transition-all cursor-pointer",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-semibold",
            isActive
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          {payer.name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{payer.name}</span>
            {payer.needs_review && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 border-warning/50 text-warning"
              >
                Revisão
              </Badge>
            )}
            {isImportedWithoutRegister(payer.review_reason) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 shrink-0 border-orange-500/50 text-orange-600"
              >
                Sem cadastro
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {payer.document_digits
                ? formatCPF(payer.document_digits)
                : payer.payer_code || "-"}
            </span>
            {payer.neighborhood && (
              <>
                <span>⬢</span>
                <span className="truncate">{payer.neighborhood}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "text-xs",
                isActive && "bg-success/10 text-success border-success/30",
              )}
            >
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {payer.billing_mode}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
}

// Empty state component
function EmptyState({
  searchTerm,
  quickFilter,
}: {
  searchTerm: string;
  quickFilter: QuickFilterKey;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-1">Nenhum pagador encontrado</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {searchTerm
          ? `Nenhum resultado para "${searchTerm}"`
          : quickFilter === "review"
            ? "Não há pagadores pendentes de revisão"
            : quickFilter === "uncatalogued"
              ? "N\u00e3o h\u00e1 pagadores criados automaticamente por importa\u00e7\u00e3o de boletos"
              : "Importe pagadores atrav\u00e9s do menu de Importa\u00e7\u00e3o"}
      </p>
    </div>
  );
}

// Quick view panel for desktop
function QuickViewPanel({ payerId }: { payerId: string | null }) {
  const { data: payerData } = usePayerById(payerId || "");

  const selectedPayer = payerData;

  const payerCode = selectedPayer?.payer_code || null;

  const { data: paidBillings } = useQuery({
    queryKey: ["payer-last-paid", payerId, payerCode],
    queryFn: async () => {
      if (!payerId) return [];
      let query = supabase
        .from("billings")
        .select("settlement_at, due_date, status, payer_id, payer_code")
        .eq("status", "PAID")
        .order("due_date", { ascending: false })
        .limit(50);

      if (payerCode) {
        query = query.or(`payer_id.eq.${payerId},payer_code.eq.${payerCode}`);
      } else {
        query = query.eq("payer_id", payerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (import.meta.env.DEV) {
        console.log("[Payers] paid billings for", { payerId, payerCode }, data);
      }
      return data || [];
    },
    enabled: !!payerId,
  });

  const { data: allBillings } = useQuery({
    queryKey: ["payer-all-billings", payerId, payerCode],
    queryFn: async () => {
      if (!payerId) return [];
      let query = supabase
        .from("billings")
        .select(
          "id, status, settlement_at, liquidation_at, due_date, payer_id, payer_code, reference_month",
        )
        .order("reference_month", { ascending: false })
        .limit(200);

      if (payerCode) {
        query = query.or(`payer_id.eq.${payerId},payer_code.eq.${payerCode}`);
      } else {
        query = query.eq("payer_id", payerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (import.meta.env.DEV) {
        console.log("[Payers] all billings for", { payerId, payerCode }, data);
      }
      return data || [];
    },
    enabled: !!payerId,
  });
  void allBillings;

  const latestPaidDate = useMemo(() => {
    if (!paidBillings || paidBillings.length == 0) return null;
    let latest = null;
    for (const b of paidBillings) {
      const raw = b.settlement_at || b.due_date;
      if (!raw) continue;
      const d = new Date(raw);
      if (!latest || d > latest) latest = d;
    }
    if (import.meta.env.DEV) {
      console.log("[Payers] latestPaidDate for", payerId, latest);
    }
    return latest;
  }, [paidBillings]);

  const billingFlags = useMemo(() => {
    const statuses = new Set((allBillings || []).map((b) => b.status));
    return {
      hasAny: (allBillings || []).length > 0,
      hasOpen: statuses.has("OPEN"),
      hasCancelled: statuses.has("CANCELADO"),
      hasPaid: statuses.has("PAID"),
    };
  }, [allBillings]);

  if (!payerId || !selectedPayer) {
    return (
      <Card className="h-[calc(100vh-280px)] flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Selecione um pagador para ver detalhes</p>
        </div>
      </Card>
    );
  }

  const isActive = selectedPayer.status === "ATIVO";

  return (
    <Card className="h-[calc(100vh-280px)] overflow-hidden">
      <ScrollArea className="h-full">
        <CardContent className="p-6">
          <motion.div
            key={payerId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {selectedPayer.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="font-semibold text-lg">{selectedPayer.name}</h3>
              <p className="text-sm text-muted-foreground font-mono">
                {selectedPayer.document_digits
                  ? formatCPF(selectedPayer.document_digits)
                  : selectedPayer.payer_code}
              </p>

              {/* Status badges */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Ativo" : "Inativo"}
                </Badge>
                <Badge variant="outline">{selectedPayer.billing_mode}</Badge>
                {selectedPayer.default_route && (
                  <Badge variant="outline">{selectedPayer.default_route}</Badge>
                )}
              </div>
            </div>

            {/* Alerts */}
            {selectedPayer.needs_review && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Necessita revisão</p>
                  {selectedPayer.review_reason && (
                    <p className="text-xs opacity-80 mt-0.5">
                      {isImportedWithoutRegister(selectedPayer.review_reason)
                        ? "Criado automaticamente na importa\u00e7\u00e3o de boletos. Cadastre/complete os dados."
                        : selectedPayer.review_reason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Contact info */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contato
              </h4>
              {selectedPayer.phone && (
                <InfoRow
                  icon={Phone}
                  label="Telefone"
                  value={formatPhone(selectedPayer.phone)}
                />
              )}
              {selectedPayer.email && (
                <InfoRow
                  icon={Mail}
                  label="E-mail"
                  value={selectedPayer.email}
                />
              )}
              {selectedPayer.neighborhood && (
                <InfoRow
                  icon={MapPin}
                  label="Bairro"
                  value={`${selectedPayer.neighborhood}${
                    selectedPayer.city ? `, ${selectedPayer.city}` : ""
                  }`}
                />
              )}
            </div>

            {/* Billing info */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cobrança
              </h4>
              <InfoRow
                icon={Receipt}
                label="Ultima ref."
                value={selectedPayer.last_billing_ref || "-"}
              />
              <InfoRow
                icon={Clock}
                label="Ultimo pagamento"
                value={
                  selectedPayer.last_payment_at
                    ? new Date(
                        selectedPayer.last_payment_at,
                      ).toLocaleDateString("pt-BR")
                    : latestPaidDate
                      ? latestPaidDate.toLocaleDateString("pt-BR")
                      : "-"
                }
              />
              {!latestPaidDate && billingFlags.hasOpen && (
                <Badge variant="outline" className="gap-1 text-warning border-warning/50">
                  <Clock className="h-3 w-3" />
                  Boleto em aberto
                </Badge>
              )}
              {!latestPaidDate && !billingFlags.hasOpen && billingFlags.hasCancelled && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  CANCELADO
                </Badge>
              )}
              {selectedPayer.pix_monthly_amount_cents && (
                <InfoRow
                  icon={Receipt}
                  label="PIX mensal"
                  value={formatCurrency(selectedPayer.pix_monthly_amount_cents)}
                />
              )}
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-2">
              {selectedPayer.is_coordinator && (
                <Badge variant="outline" className="gap-1">
                  <UserCheck className="h-3 w-3" />
                  Coordenador
                </Badge>
              )}
              {selectedPayer.document_valid && (
                <Badge variant="outline" className="gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  CPF válido
                </Badge>
              )}
              {selectedPayer.match_ok && (
                <Badge variant="outline" className="gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Endereço OK
                </Badge>
              )}
            </div>
          </motion.div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

// Info row component
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

