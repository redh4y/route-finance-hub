import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePayers, usePayersStats, usePayerById, Payer } from "@/hooks/usePayers";
import { supabase } from "@/integrations/supabase/client";
import { PayerDetailsModal } from "@/components/payers/PayerDetailsModal";
import { PageTransition } from "@/components/ui/page-transition";
import { formatCPF, formatPhone, formatCurrency } from "@/lib/formatters";
import { validateCPF } from "@/lib/csv-import";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  X,
  Phone,
  Mail,
  MapPin,
  Receipt,
  CheckCircle2,
  Clock,
  Edit,
  Plus,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  { key: "all", label: "Todos", icon: Users },
  { key: "active", label: "Ativos", icon: UserCheck },
  { key: "inactive", label: "Inativos", icon: UserX },
  { key: "review", label: "Revisão", icon: AlertTriangle },
  { key: "uncatalogued", label: "Sem cadastro", icon: AlertCircle },
] as const;

type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

const IMPORT_MISSING_PAYER_REASON = "IMPORT_BILLING_SEM_CADASTRO";

function isImportedWithoutRegister(reviewReason: string | null | undefined): boolean {
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

  const filters = useMemo(() => {
    switch (quickFilter) {
      case "active": return { status: "ATIVO" };
      case "inactive": return { status: "INATIVO" };
      case "review": return { needsReview: true };
      case "uncatalogued": return { reviewReason: IMPORT_MISSING_PAYER_REASON };
      default: return {};
    }
  }, [quickFilter]);

  useEffect(() => { setPage(1); }, [quickFilter, searchTerm]);

  const { data: payersResult, isLoading, error } = usePayers({
    ...filters,
    search: searchTerm || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const payers = payersResult?.rows || [];
  const totalCount = payersResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: stats = { total: 0, active: 0, inactive: 0, review: 0, uncatalogued: 0 } } = usePayersStats();

  const clearSearch = () => setSearchTerm("");

  const resetNewPayer = () => {
    setNewPayer({ name: "", document: "", phone: "", neighborhood: "", billingMode: "BOLETO", status: "ATIVO" });
  };

  const handleCreatePayer = async () => {
    const name = newPayer.name.trim();
    if (!name) { toast.error("Informe o nome do pagador."); return; }
    const documentDigits = newPayer.document.replace(/\D/g, "");
    const phoneDigits = newPayer.phone.replace(/\D/g, "");
    setIsCreating(true);
    try {
      const { error } = await supabase.from("payers").insert([{
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
      }]);
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

  const filterCount = (key: QuickFilterKey) => {
    switch (key) {
      case "all": return stats.total;
      case "active": return stats.active;
      case "inactive": return stats.inactive;
      case "review": return stats.review;
      case "uncatalogued": return stats.uncatalogued;
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-4 sm:space-y-6 overflow-hidden">
          {/* ── Header ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pagadores</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Gerencie alunos, cobranças e cadastros
              </p>
            </div>
            <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="sm:inline">Novo pagador</span>
            </Button>
          </div>

          {/* ── Stats row (scrollable on mobile) ── */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-1">
            {QUICK_FILTERS.map((filter) => {
              const isSelected = quickFilter === filter.key;
              const count = filterCount(filter.key);
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
                  className={cn("gap-1 sm:gap-1.5 text-xs shrink-0 whitespace-nowrap px-2 sm:px-3", isSelected && "shadow-sm")}
                >
                  <filter.icon className={cn("h-3.5 w-3.5", iconColorClasses)} />
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="ml-0.5 tabular-nums text-muted-foreground/60">{count}</span>
                </Button>
              );
            })}
          </div>

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Erro ao carregar pagadores: {error.message}
            </div>
          )}

          {/* ── Main content ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Payers list */}
            <div className="lg:col-span-2">
              <Card>
                <div className="h-[calc(100vh-360px)] sm:h-[calc(100vh-310px)] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 sm:h-20 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : payers.length > 0 ? (
                    <>
                      {/* Mobile: Card list */}
                      <div className="lg:hidden divide-y divide-border">
                        {payers.map((payer) => (
                          <PayerCardMobile
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
                              <TableHead className="text-center">Modo</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
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
                    <EmptyState searchTerm={searchTerm} quickFilter={quickFilter} />
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-3 py-2 sm:px-4 sm:py-3">
                    <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                      <span className="hidden sm:inline">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de{" "}
                      </span>
                      <span className="sm:hidden">Pág {page}/{totalPages} · </span>
                      {totalCount}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}>
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      {/* Page numbers - hidden on very small screens */}
                      <div className="hidden sm:flex items-center gap-1">
                        {(() => {
                          const pages: (number | string)[] = [];
                          const maxVisible = 5;
                          let start = Math.max(1, page - Math.floor(maxVisible / 2));
                          let end = Math.min(totalPages, start + maxVisible - 1);
                          if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                          if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
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
                              <span key={`e-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                            ) : (
                              <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="h-8 min-w-[2rem] text-xs" onClick={() => setPage(p)}>
                                {p}
                              </Button>
                            )
                          );
                        })()}
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Quick view panel - desktop */}
            <div className="hidden lg:block">
              <QuickViewPanel payerId={selectedPayerId} />
            </div>
          </div>

          {/* Mobile: Quick view sheet */}
          {isMobile && (
            <Sheet open={!!selectedPayerId} onOpenChange={(open) => !open && setSelectedPayerId(null)}>
              <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Detalhes do pagador</SheetTitle>
                </SheetHeader>
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20 mx-auto mt-3 mb-1" />
                <ScrollArea className="h-[calc(75vh-2rem)]">
                  <QuickViewPanel payerId={selectedPayerId} isMobileSheet />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <PayerDetailsModal payerId={editPayerId} onClose={() => setEditPayerId(null)} />

        {/* Create dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetNewPayer(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo pagador</DialogTitle>
              <DialogDescription>Cadastre manualmente um pagador.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-payer-name">Nome</Label>
                <Input id="new-payer-name" value={newPayer.name} onChange={(e) => setNewPayer((p) => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-payer-document">CPF</Label>
                  <Input id="new-payer-document" value={newPayer.document} onChange={(e) => setNewPayer((p) => ({ ...p, document: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-payer-phone">Telefone</Label>
                  <Input id="new-payer-phone" value={newPayer.phone} onChange={(e) => setNewPayer((p) => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-payer-neighborhood">Bairro</Label>
                <Input id="new-payer-neighborhood" value={newPayer.neighborhood} onChange={(e) => setNewPayer((p) => ({ ...p, neighborhood: e.target.value }))} placeholder="Bairro" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Modo de cobrança</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newPayer.billingMode} onChange={(e) => setNewPayer((p) => ({ ...p, billingMode: e.target.value }))}>
                    <option value="BOLETO">BOLETO</option>
                    <option value="PIX_ONLY">PIX_ONLY</option>
                    <option value="MIXED">MIXED</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newPayer.status} onChange={(e) => setNewPayer((p) => ({ ...p, status: e.target.value }))}>
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancelar</Button>
              <Button onClick={handleCreatePayer} disabled={isCreating}>{isCreating ? "Salvando..." : "Adicionar pagador"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}

/* ═══════════════════════════════════════════════ */
/*  SUB-COMPONENTS                                 */
/* ═══════════════════════════════════════════════ */

// ── Mobile payer card ──
function PayerCardMobile({
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
    <div
      onClick={onClick}
      className={cn(
        "px-3 py-3 active:bg-muted/60 transition-colors cursor-pointer overflow-hidden",
        isSelected && "bg-primary/5"
      )}
    >
      {/* Row 1: Avatar + Name + Badges + Edit */}
      <div className="flex items-center gap-2 w-full overflow-hidden">
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-xs font-bold",
            isActive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {payer.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 w-0">
          <span className="font-medium text-sm truncate block">{payer.name}</span>
        </div>

        {payer.needs_review && (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        )}

        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 shrink-0",
            isActive
              ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
              : "text-muted-foreground"
          )}
        >
          {isActive ? "Ativo" : "Inativo"}
        </Badge>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          aria-label="Editar"
        >
          <Edit className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: CPF + Phone + Billing mode */}
      <div className="flex items-center gap-1.5 mt-0.5 ml-[44px] text-xs text-muted-foreground">
        <span className="font-mono truncate">
          {payer.document_digits ? formatCPF(payer.document_digits) : payer.payer_code || "—"}
        </span>
        {payer.phone && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate">{formatPhone(payer.phone)}</span>
          </>
        )}
        <span className="opacity-40">·</span>
        <span className="shrink-0">{payer.billing_mode}</span>
      </div>
    </div>
  );
}

// ── Desktop table row ──
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
        isSelected && "bg-primary/5"
      )}
    >
      <TableCell>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-semibold",
              isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {payer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{payer.name}</span>
              {payer.is_coordinator && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">Coord</Badge>
              )}
              {payer.needs_review && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-amber-500/50 text-amber-600">Revisão</Badge>
              )}
              {isImportedWithoutRegister(payer.review_reason) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-orange-500/50 text-orange-600">Sem cadastro</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="font-mono">
                {payer.document_digits ? formatCPF(payer.document_digits) : payer.payer_code || "-"}
              </span>
              {payer.phone && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="truncate">{formatPhone(payer.phone)}</span>
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
            "border-emerald-500/40 text-emerald-600 bg-emerald-500/5": payer.billing_mode === "PIX_ONLY",
            "border-amber-500/40 text-amber-600 bg-amber-500/5": payer.billing_mode === "MIXED",
            "border-sky-500/40 text-sky-600 bg-sky-500/5": payer.billing_mode === "BOLETO",
          })}
        >
          {payer.billing_mode}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={cn("text-xs", isActive && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30")}
        >
          {isActive ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Edit className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ── Empty state ──
function EmptyState({ searchTerm, quickFilter }: { searchTerm: string; quickFilter: QuickFilterKey }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-base mb-1">Nenhum pagador encontrado</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {searchTerm
          ? `Nenhum resultado para "${searchTerm}"`
          : quickFilter === "review"
            ? "Não há pagadores pendentes de revisão"
            : quickFilter === "uncatalogued"
              ? "Não há pagadores criados automaticamente"
              : "Importe pagadores através do menu de Importação"}
      </p>
    </div>
  );
}

// ── Quick view panel ──
function QuickViewPanel({ payerId, isMobileSheet = false }: { payerId: string | null; isMobileSheet?: boolean }) {
  const { data: selectedPayer } = usePayerById(payerId || "");
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
      if (payerCode) query = query.or(`payer_id.eq.${payerId},payer_code.eq.${payerCode}`);
      else query = query.eq("payer_id", payerId);
      const { data, error } = await query;
      if (error) throw error;
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
        .select("id, status, settlement_at, liquidation_at, due_date, payer_id, payer_code, reference_month")
        .order("reference_month", { ascending: false })
        .limit(200);
      if (payerCode) query = query.or(`payer_id.eq.${payerId},payer_code.eq.${payerCode}`);
      else query = query.eq("payer_id", payerId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!payerId,
  });

  const latestPaidDate = useMemo(() => {
    if (!paidBillings || paidBillings.length === 0) return null;
    let latest: Date | null = null;
    for (const b of paidBillings) {
      const raw = b.settlement_at || b.due_date;
      if (!raw) continue;
      const d = new Date(raw);
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, [paidBillings]);

  const billingFlags = useMemo(() => {
    const statuses = new Set((allBillings || []).map((b) => b.status));
    return { hasAny: (allBillings || []).length > 0, hasOpen: statuses.has("OPEN"), hasCancelled: statuses.has("CANCELADO"), hasPaid: statuses.has("PAID") };
  }, [allBillings]);

  if (!payerId || !selectedPayer) {
    if (isMobileSheet) return null;
    return (
      <Card className="h-[calc(100vh-310px)] flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um pagador</p>
        </div>
      </Card>
    );
  }

  const isActive = selectedPayer.status === "ATIVO";

  const content = (
    <motion.div
      key={payerId}
      initial={{ opacity: 0, y: isMobileSheet ? 10 : 0, x: isMobileSheet ? 0 : 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className={cn("text-center", isMobileSheet && "pt-2")}>
        <div
          className={cn(
            "w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold",
            isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
          )}
        >
          {selectedPayer.name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-semibold text-base">{selectedPayer.name}</h3>
        <p className="text-xs text-muted-foreground font-mono">
          {selectedPayer.document_digits ? formatCPF(selectedPayer.document_digits) : selectedPayer.payer_code}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
          <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
          <Badge variant="outline" className="text-xs">{selectedPayer.billing_mode}</Badge>
          {selectedPayer.default_route && selectedPayer.default_route !== "DESCONHECIDO" && (
            <Badge variant="outline" className="text-xs">{selectedPayer.default_route}</Badge>
          )}
        </div>
      </div>

      {/* Alerts */}
      {selectedPayer.needs_review && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium">Necessita revisão</p>
            {selectedPayer.review_reason && (
              <p className="opacity-80 mt-0.5">
                {isImportedWithoutRegister(selectedPayer.review_reason)
                  ? "Criado automaticamente na importação de boletos."
                  : selectedPayer.review_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-2.5">
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contato</h4>
        {selectedPayer.phone && <InfoRow icon={Phone} label="Telefone" value={formatPhone(selectedPayer.phone)} />}
        {selectedPayer.email && <InfoRow icon={Mail} label="E-mail" value={selectedPayer.email} />}
        {selectedPayer.neighborhood && (
          <InfoRow icon={MapPin} label="Bairro" value={`${selectedPayer.neighborhood}${selectedPayer.city ? `, ${selectedPayer.city}` : ""}`} />
        )}
        {!selectedPayer.phone && !selectedPayer.email && !selectedPayer.neighborhood && (
          <p className="text-xs text-muted-foreground italic">Sem dados de contato</p>
        )}
      </div>

      {/* Billing info */}
      <div className="space-y-2.5">
        <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cobrança</h4>
        <InfoRow icon={Receipt} label="Última ref." value={selectedPayer.last_billing_ref || "-"} />
        <InfoRow
          icon={Clock}
          label="Último pagamento"
          value={
            selectedPayer.last_payment_at
              ? new Date(selectedPayer.last_payment_at).toLocaleDateString("pt-BR")
              : latestPaidDate
                ? latestPaidDate.toLocaleDateString("pt-BR")
                : "-"
          }
        />
        {!latestPaidDate && billingFlags.hasOpen && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/50 text-xs">
            <Clock className="h-3 w-3" />
            Boleto em aberto
          </Badge>
        )}
        {selectedPayer.pix_monthly_amount_cents && (
          <InfoRow icon={Receipt} label="PIX mensal" value={formatCurrency(selectedPayer.pix_monthly_amount_cents)} />
        )}
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-1.5">
        {selectedPayer.is_coordinator && (
          <Badge variant="outline" className="gap-1 text-xs"><UserCheck className="h-3 w-3" />Coordenador</Badge>
        )}
        {selectedPayer.document_valid && (
          <Badge variant="outline" className="gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" />CPF válido</Badge>
        )}
        {selectedPayer.match_ok && (
          <Badge variant="outline" className="gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" />Endereço OK</Badge>
        )}
      </div>
    </motion.div>
  );

  if (isMobileSheet) {
    return <div className="px-5 pb-6">{content}</div>;
  }

  return (
    <Card className="h-[calc(100vh-310px)] overflow-hidden">
      <ScrollArea className="h-full">
        <CardContent className="p-5">{content}</CardContent>
      </ScrollArea>
    </Card>
  );
}

// ── Info row ──
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
