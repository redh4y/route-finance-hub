import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePayers } from "@/hooks/usePayers";
import { PayerDetailsModal } from "@/components/payers/PayerDetailsModal";
import { PageTransition } from "@/components/ui/page-transition";
import { formatCPF, formatPhone, formatCurrency } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Users,
  AlertCircle,
  Filter,
  X,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Quick filter buttons
const QUICK_FILTERS = [
  { key: "all", label: "Todos", icon: Users },
  { key: "active", label: "Ativos", icon: UserCheck },
  { key: "inactive", label: "Inativos", icon: UserX },
  { key: "review", label: "Revisão", icon: AlertTriangle },
] as const;

type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

export default function Payers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("active");
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);

  // Build filters based on quick filter
  const filters = useMemo(() => {
    switch (quickFilter) {
      case "active":
        return { status: "ATIVO" };
      case "inactive":
        return { status: "INATIVO" };
      case "review":
        return { needsReview: true };
      default:
        return {};
    }
  }, [quickFilter]);

  const { data: payers, isLoading, error } = usePayers({
    ...filters,
    search: searchTerm || undefined,
  });

  // Stats
  const stats = useMemo(() => {
    if (!payers) return { total: 0, active: 0, inactive: 0, review: 0 };
    return {
      total: payers.length,
      active: payers.filter((p) => p.status === "ATIVO").length,
      inactive: payers.filter((p) => p.status === "INATIVO").length,
      review: payers.filter((p) => p.needs_review).length,
    };
  }, [payers]);

  const clearSearch = () => {
    setSearchTerm("");
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
              {QUICK_FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  variant={quickFilter === filter.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setQuickFilter(filter.key)}
                  className={cn(
                    "gap-1.5 text-xs",
                    quickFilter === filter.key && "shadow-sm"
                  )}
                >
                  <filter.icon className="h-3.5 w-3.5" />
                  {filter.label}
                </Button>
              ))}
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
              <p className="text-sm">Erro ao carregar pagadores: {error.message}</p>
            </motion.div>
          )}

          {/* Main content */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Payers list */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  {isLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : payers && payers.length > 0 ? (
                    <div className="divide-y">
                      <AnimatePresence mode="popLayout">
                        {payers.map((payer, index) => (
                          <PayerRow
                            key={payer.id}
                            payer={payer}
                            index={index}
                            isSelected={selectedPayerId === payer.id}
                            onClick={() => setSelectedPayerId(payer.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <EmptyState searchTerm={searchTerm} quickFilter={quickFilter} />
                  )}
                </ScrollArea>
              </Card>
            </div>

            {/* Quick view panel */}
            <div className="hidden lg:block">
              <QuickViewPanel payerId={selectedPayerId} />
            </div>
          </div>
        </div>

        {/* Mobile modal */}
        <div className="lg:hidden">
          <PayerDetailsModal
            payerId={selectedPayerId}
            onClose={() => setSelectedPayerId(null)}
          />
        </div>
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
        }
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
  index,
  isSelected,
  onClick,
}: {
  payer: ReturnType<typeof usePayers>["data"] extends (infer T)[] | undefined
    ? T
    : never;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!payer) return null;

  const isActive = payer.status === "ATIVO";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-muted/50",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      {/* Avatar / Status indicator */}
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

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{payer.name}</span>
          {payer.is_coordinator && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              Coord
            </Badge>
          )}
          {payer.needs_review && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0 border-amber-500/50 text-amber-600"
            >
              Revisão
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="font-mono">
            {payer.document_digits
              ? formatCPF(payer.document_digits)
              : payer.payer_code || "—"}
          </span>
          {payer.neighborhood && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="truncate">{payer.neighborhood}</span>
            </>
          )}
        </div>
      </div>

      {/* Right side info */}
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <Badge variant="outline" className="text-xs">
          {payer.billing_mode}
        </Badge>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isActive && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
          )}
        >
          {isActive ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
          : "Importe pagadores através do menu de Importação"}
      </p>
    </div>
  );
}

// Quick view panel for desktop
function QuickViewPanel({ payerId }: { payerId: string | null }) {
  const { data: payer, isLoading } = usePayers({});

  const selectedPayer = payer?.find((p) => p.id === payerId);

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
                    : "bg-muted text-muted-foreground"
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
                      {selectedPayer.review_reason}
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
                <InfoRow icon={Mail} label="E-mail" value={selectedPayer.email} />
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
                label="Última ref."
                value={selectedPayer.last_billing_ref || "—"}
              />
              <InfoRow
                icon={Clock}
                label="Último pagamento"
                value={
                  selectedPayer.last_payment_at
                    ? new Date(selectedPayer.last_payment_at).toLocaleDateString(
                        "pt-BR"
                      )
                    : "—"
                }
              />
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
