import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useExcursions, useUpdateExcursion, useDeleteExcursion } from "@/hooks/useExcursions";
import { formatCurrency } from "@/lib/formatters";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Bus, MapPin, Calendar, Users, Search, Ticket, TrendingUp,
  ShoppingBag, Eye, Play, Pause, Copy, ExternalLink, MoreHorizontal,
  Edit, XCircle, CheckCircle2, Link2, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; bg: string }> = {
  RASCUNHO: { label: "Rascunho", variant: "outline", bg: "bg-muted/50" },
  EM_VENDA: { label: "Em Venda", variant: "default", bg: "bg-success/5 border-success/20" },
  LOTADA: { label: "Lotada", variant: "destructive", bg: "bg-warning/5 border-warning/20" },
  FINALIZADA: { label: "Finalizada", variant: "secondary", bg: "bg-accent/5 border-accent/20" },
  CANCELADA: { label: "Cancelada", variant: "outline", bg: "bg-destructive/5 border-destructive/20" },
};

type StatusFilter = "ALL" | "EM_VENDA" | "RASCUNHO" | "LOTADA" | "FINALIZADA" | "CANCELADA";

const filterTabs: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "EM_VENDA", label: "Em Venda" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "LOTADA", label: "Lotada" },
  { value: "FINALIZADA", label: "Finalizada" },
  { value: "CANCELADA", label: "Cancelada" },
];

export default function Excursions() {
  const { data: excursions, isLoading } = useExcursions();
  const deleteExcursion = useDeleteExcursion();
  const updateExcursion = useUpdateExcursion();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const isMobile = useIsMobile();

  const all = excursions || [];
  const filtered = all.filter((e) => {
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.destination.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = all.reduce((sum, e) => sum + e.seat_price_cents * e.total_seats, 0);
  const emVenda = all.filter((e) => e.status === "EM_VENDA").length;
  const totalSeats = all.reduce((sum, e) => sum + e.total_seats, 0);

  const statCards = [
    { label: "Excursões", value: all.length, icon: Bus, color: "text-accent" },
    { label: "Em Venda", value: emVenda, icon: ShoppingBag, color: "text-success" },
    { label: "Assentos", value: totalSeats, icon: Ticket, color: "text-warning" },
    { label: "Receita Potencial", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-primary" },
  ];

  const handleStatusChange = (id: string, newStatus: string) => {
    updateExcursion.mutate({ id, status: newStatus } as any);
  };

  const handleCopyLink = (exc: typeof all[0]) => {
    if (exc.public_token) {
      const url = `${window.location.origin}/excursao/${exc.public_token}`;
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } else {
      toast.error("Excursão não possui link público");
    }
  };

  const handleTogglePublic = (exc: typeof all[0]) => {
    updateExcursion.mutate({ id: exc.id, public_enabled: !exc.public_enabled } as any);
  };

  return (
    <MainLayout>
      <PageTransition>
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="page-title">Excursões</h1>
              <p className="page-subtitle">Gerencie viagens e venda de assentos</p>
            </div>
            <Link to="/excursoes/nova">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Excursão
              </Button>
            </Link>
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
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((tab) => {
              const count = tab.value === "ALL" ? all.length : all.filter((e) => e.status === tab.value).length;
              const active = statusFilter === tab.value;
              return (
                <Button
                  key={tab.value}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(tab.value)}
                  className="shrink-0 relative"
                >
                  {tab.label}
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem]">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 pb-6 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Bus className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-1">Nenhuma excursão encontrada</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Tente alterar os filtros ou crie uma nova</p>
            <Link to="/excursoes/nova">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1.5" />
                Nova Excursão
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <TooltipProvider delayDuration={300}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((exc, i) => {
                    const cfg = statusConfig[exc.status] || statusConfig.RASCUNHO;
                    const canStart = exc.status === "RASCUNHO";
                    const canPause = exc.status === "EM_VENDA";
                    const canFinish = exc.status === "EM_VENDA" || exc.status === "LOTADA";
                    const hasPublicLink = exc.public_token && exc.public_enabled;

                    return (
                      <motion.div
                        key={exc.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: i * 0.02 }}
                      >
                        <Card className={`hover:shadow-md transition-all h-full border ${cfg.bg} flex flex-col`}>
                          {/* Clickable body */}
                          <Link to={`/excursoes/${exc.id}`} className="flex-1">
                            <CardContent className="pt-5 pb-3 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-sm leading-tight line-clamp-2">{exc.name}</h3>
                                <Badge variant={cfg.variant} className="shrink-0 text-[10px]">
                                  {cfg.label}
                                </Badge>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {exc.destination}
                                    {exc.destination_state ? `/${exc.destination_state}` : ""}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {new Date(exc.departure_at).toLocaleDateString("pt-BR", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Users className="h-3.5 w-3.5 shrink-0" />
                                  <span>{exc.total_seats} assentos</span>
                                </div>
                                {exc.vehicles?.name && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Bus className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{exc.vehicles.name}</span>
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t flex items-center justify-between">
                                <span className="text-sm font-semibold text-primary">
                                  {formatCurrency(exc.seat_price_cents)}
                                  <span className="text-xs font-normal text-muted-foreground"> /assento</span>
                                </span>
                                {hasPublicLink && (
                                  <Badge variant="outline" className="text-[9px] gap-1 px-1.5 py-0 h-4 text-success border-success/30">
                                    <Link2 className="h-2.5 w-2.5" />
                                    Online
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Link>

                          {/* Quick Actions Footer */}
                          <div className="px-4 pb-3 pt-0 flex items-center gap-1.5 border-t mt-auto">
                            {/* Primary action based on status */}
                            {canStart && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs flex-1 text-success border-success/30 hover:bg-success/10"
                                    onClick={() => handleStatusChange(exc.id, "EM_VENDA")}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Iniciar Vendas
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Abrir vendas desta excursão</TooltipContent>
                              </Tooltip>
                            )}

                            {canPause && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs flex-1 text-warning border-warning/30 hover:bg-warning/10"
                                    onClick={() => handleStatusChange(exc.id, "RASCUNHO")}
                                  >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pausar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Pausar vendas (volta a rascunho)</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Copy public link */}
                            {exc.public_token && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleCopyLink(exc)}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar link público</TooltipContent>
                              </Tooltip>
                            )}

                            {/* View detail */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => navigate(`/excursoes/${exc.id}`)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalhes</TooltipContent>
                            </Tooltip>

                            {/* More actions dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-auto">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => navigate(`/excursoes/${exc.id}`)}>
                                  <Eye className="h-3.5 w-3.5 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTogglePublic(exc)}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                  {exc.public_enabled ? "Desativar Link Público" : "Ativar Link Público"}
                                </DropdownMenuItem>
                                {exc.public_token && (
                                  <DropdownMenuItem onClick={() => handleCopyLink(exc)}>
                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                    Copiar Link
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {canStart && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(exc.id, "EM_VENDA")}>
                                    <Play className="h-3.5 w-3.5 mr-2 text-success" />
                                    Iniciar Vendas
                                  </DropdownMenuItem>
                                )}
                                {canPause && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(exc.id, "RASCUNHO")}>
                                    <Pause className="h-3.5 w-3.5 mr-2 text-warning" />
                                    Pausar Vendas
                                  </DropdownMenuItem>
                                )}
                                {canFinish && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(exc.id, "FINALIZADA")}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-primary" />
                                    Finalizar
                                  </DropdownMenuItem>
                                )}
                                {exc.status !== "CANCELADA" && exc.status !== "FINALIZADA" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleStatusChange(exc.id, "CANCELADA")}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-2" />
                                      Cancelar Excursão
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget({ id: exc.id, name: exc.name })}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Excluir Excursão
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground text-center mt-4">
              {filtered.length} excursão(ões) encontrada(s)
            </p>
          </>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir excursão?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita e todos os assentos vinculados serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) {
                    deleteExcursion.mutate(deleteTarget.id);
                    setDeleteTarget(null);
                  }
                }}
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
