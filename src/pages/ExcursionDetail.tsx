import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  useExcursion, useExcursionSeats, useTicketSales, useSellTicket, useUpdateExcursion,
} from "@/hooks/useExcursions";
import {
  useAffiliates, useExcursionAffiliates, useLinkAffiliate, useUnlinkAffiliate, usePublicOrders,
} from "@/hooks/useAffiliates";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowLeft, MapPin, Calendar, Users, Bus, ShoppingCart, CheckCircle2,
  DollarSign, Link2, Copy, ExternalLink, Users2, Trash2, Plus, Clock, Armchair,
  TrendingUp, Eye, EyeOff, Pencil, Phone, Mail, CreditCard, Banknote, QrCode,
  FileText, AlertCircle, Globe, ChevronRight, Hash, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Seat Color Tokens ─── */
const seatColors: Record<string, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer",
  RESERVADO: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  VENDIDO: "bg-primary/20 text-primary border-primary/40",
  CANCELADO: "bg-muted text-muted-foreground border-muted",
  BLOQUEADO: "bg-destructive/20 text-destructive border-destructive/40",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  RASCUNHO: { label: "Rascunho", variant: "outline", color: "text-muted-foreground" },
  EM_VENDA: { label: "Em Venda", variant: "default", color: "text-primary" },
  LOTADA: { label: "Lotada", variant: "destructive", color: "text-destructive" },
  FINALIZADA: { label: "Finalizada", variant: "secondary", color: "text-muted-foreground" },
  CANCELADA: { label: "Cancelada", variant: "outline", color: "text-destructive" },
};

const orderStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  RESERVADO: { label: "Reservado", variant: "secondary" },
  VENDIDO: { label: "Pago", variant: "default" },
  CANCELADO: { label: "Cancelado", variant: "outline" },
  EXPIRADO: { label: "Expirado", variant: "destructive" },
};

const paymentIcons: Record<string, typeof CreditCard> = {
  DINHEIRO: Banknote,
  PIX: QrCode,
  CARTAO: CreditCard,
  BOLETO: FileText,
};

export default function ExcursionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: excursion, isLoading, refetch: refetchExcursion } = useExcursion(id);
  const { data: seats } = useExcursionSeats(id);
  const { data: sales } = useTicketSales(id);
  const { data: affiliates } = useAffiliates();
  const { data: excursionAffiliates } = useExcursionAffiliates(id);
  const { data: publicOrders } = usePublicOrders(id);
  const sellTicket = useSellTicket();
  const updateExcursion = useUpdateExcursion();
  const linkAffiliate = useLinkAffiliate();
  const unlinkAffiliate = useUnlinkAffiliate();

  const [sellOpen, setSellOpen] = useState(false);
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState("");
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [passengerName, setPassengerName] = useState("");
  const [passengerDoc, setPassengerDoc] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [installments, setInstallments] = useState("1");
  const [activeTab, setActiveTab] = useState<"seats" | "sales" | "affiliates" | "orders">("seats");

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-pulse space-y-4 w-full max-w-2xl">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
            </div>
            <div className="h-64 bg-muted rounded-xl mt-4" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!excursion) {
    return (
      <MainLayout>
        <div className="text-center py-24">
          <Bus className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-2">Excursão não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/excursoes")}>Voltar</Button>
        </div>
      </MainLayout>
    );
  }

  const soldSeats = (seats || []).filter((s) => s.status === "VENDIDO").length;
  const reservedSeats = (seats || []).filter((s) => s.status === "RESERVADO").length;
  const blockedSeats = (seats || []).filter((s) => s.blocked).length;
  const availableSeats = (seats || []).filter((s) => s.status === "DISPONIVEL" && !s.blocked).length;
  const occupancy = excursion.total_seats > 0 ? Math.round(((soldSeats + reservedSeats) / excursion.total_seats) * 100) : 0;
  const totalRevenue = (sales || []).reduce((sum, s) => sum + s.amount_cents, 0);
  const onlineRevenue = (publicOrders || []).reduce((sum: number, o: any) => sum + (o.amount_paid_cents || 0), 0);
  const potentialRevenue = excursion.total_seats * excursion.seat_price_cents;
  const statusCfg = statusConfig[excursion.status] || statusConfig.RASCUNHO;

  const toggleSeat = (seatNumber: number) => {
    const seat = seats?.find((s) => s.seat_number === seatNumber);
    if (!seat || seat.status !== "DISPONIVEL" || seat.blocked) return;
    setSelectedSeats((prev) =>
      prev.includes(seatNumber) ? prev.filter((n) => n !== seatNumber) : [...prev, seatNumber]
    );
  };

  const handleSell = () => {
    if (!passengerName || selectedSeats.length === 0) {
      toast.error("Informe o passageiro e selecione ao menos um assento");
      return;
    }
    const amount = selectedSeats.length * excursion.seat_price_cents;
    sellTicket.mutate(
      {
        excursion_id: excursion.id,
        passenger: {
          name: passengerName,
          document: passengerDoc || undefined,
          phone: passengerPhone || undefined,
          email: passengerEmail || undefined,
        },
        seat_numbers: selectedSeats,
        amount_cents: amount,
        payment_method: paymentMethod,
        installments: parseInt(installments) || 1,
      },
      {
        onSuccess: () => {
          setSellOpen(false);
          setSelectedSeats([]);
          setPassengerName("");
          setPassengerDoc("");
          setPassengerPhone("");
          setPassengerEmail("");
        },
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateExcursion.mutate({ id: excursion.id, status: newStatus } as any);
  };

  const generatePublicLink = async () => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { error } = await supabase
      .from("excursions")
      .update({ public_token: token, public_enabled: true } as any)
      .eq("id", excursion.id);
    if (error) { toast.error("Erro ao gerar link"); return; }
    refetchExcursion();
    toast.success("Link público gerado!");
  };

  const togglePublicEnabled = async () => {
    const { error } = await supabase
      .from("excursions")
      .update({ public_enabled: !excursion.public_enabled } as any)
      .eq("id", excursion.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    refetchExcursion();
    toast.success(excursion.public_enabled ? "Link desativado" : "Link ativado");
  };

  const publicUrl = excursion.public_token
    ? `${window.location.origin}/public/excursoes/${excursion.public_token}`
    : null;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleLinkAffiliate = () => {
    if (!selectedAffiliate) return;
    linkAffiliate.mutate(
      { affiliate_id: selectedAffiliate, excursion_id: excursion.id },
      { onSuccess: () => { setAffiliateOpen(false); setSelectedAffiliate(""); } }
    );
  };

  const unlinkedAffiliates = (affiliates || []).filter(
    (a) => a.status === "ATIVO" && !(excursionAffiliates || []).some((ea) => ea.affiliate_id === a.id)
  );

  const seatRows: number[][] = [];
  const totalS = seats?.length || excursion.total_seats;
  for (let i = 0; i < totalS; i += 4) {
    const row: number[] = [];
    for (let j = 0; j < 4 && i + j < totalS; j++) row.push(i + j + 1);
    seatRows.push(row);
  }

  const tabs = [
    { key: "seats" as const, label: "Mapa", shortLabel: "Mapa", icon: Armchair },
    { key: "sales" as const, label: "Vendas", shortLabel: "Vendas", icon: ShoppingCart, count: sales?.length },
    { key: "affiliates" as const, label: "Afiliados", shortLabel: "Afil.", icon: Users2, count: excursionAffiliates?.length },
    { key: "orders" as const, label: "Pedidos Online", shortLabel: "Online", icon: Globe, count: publicOrders?.length },
  ];

  const depDate = new Date(excursion.departure_at);
  const retDate = excursion.return_at ? new Date(excursion.return_at) : null;
  const isPast = depDate < new Date();
  const daysUntil = Math.ceil((depDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <MainLayout>
      <PageTransition>
        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border mb-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
          <div className="relative p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/excursoes")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{excursion.name}</h1>
                    <Badge variant={statusCfg.variant} className="shrink-0">{statusCfg.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {excursion.destination}{excursion.destination_state ? `/${excursion.destination_state}` : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {depDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {excursion.vehicles?.name && (
                      <span className="flex items-center gap-1">
                        <Bus className="h-3.5 w-3.5" />
                        {excursion.vehicles.name}
                      </span>
                    )}
                  </div>
                  {!isPast && daysUntil >= 0 && (
                    <p className="text-xs text-primary font-medium mt-1.5">
                      {daysUntil === 0 ? "🚌 Hoje!" : daysUntil === 1 ? "Amanhã" : `Em ${daysUntil} dias`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                <Select value={excursion.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[130px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="EM_VENDA">Em Venda</SelectItem>
                    <SelectItem value="LOTADA">Lotada</SelectItem>
                    <SelectItem value="FINALIZADA">Finalizada</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => navigate(`/excursoes/editar/${excursion.id}`)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
                <Button
                  onClick={() => { setActiveTab("seats"); setSellOpen(true); }}
                  disabled={excursion.status === "CANCELADA" || excursion.status === "FINALIZADA"}
                  size="sm"
                >
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                  Vender
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-5">
          {[
            {
              label: "Ocupação",
              value: `${occupancy}%`,
              sub: `${soldSeats + reservedSeats}/${excursion.total_seats}`,
              icon: TrendingUp,
              color: occupancy >= 80 ? "text-emerald-500" : occupancy >= 50 ? "text-amber-500" : "text-muted-foreground",
            },
            { label: "Vendidos", value: soldSeats, sub: `${availableSeats} disponíveis`, icon: CheckCircle2, color: "text-emerald-500" },
            { label: "Reservados", value: reservedSeats, sub: blockedSeats > 0 ? `${blockedSeats} bloqueados` : undefined, icon: Clock, color: "text-amber-500" },
            { label: "Receita Balcão", value: formatCurrency(totalRevenue), sub: sales?.length ? `${sales.length} vendas` : undefined, icon: DollarSign, color: "text-primary" },
            { label: "Receita Online", value: formatCurrency(onlineRevenue), sub: publicOrders?.length ? `${publicOrders.length} pedidos` : undefined, icon: Globe, color: "text-accent" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="group hover:shadow-md transition-all duration-200 h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <s.icon className={cn("h-5 w-5", s.color)} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                  {s.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Occupancy Bar ── */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1.5">
            <Progress value={occupancy} className="h-2.5 flex-1" />
            <span className="text-sm font-semibold tabular-nums w-12 text-right">{occupancy}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{soldSeats} vendidos · {reservedSeats} reservados</span>
            <span>Potencial: {formatCurrency(potentialRevenue)}</span>
          </div>
        </div>

        {/* ── Public Link ── */}
        <Card className="mb-5 border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("p-1.5 rounded-md", excursion.public_enabled ? "bg-emerald-500/10" : "bg-muted")}>
                  {excursion.public_enabled ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium">Link Público</span>
                  {excursion.public_token && (
                    <Badge variant={excursion.public_enabled ? "default" : "outline"} className="text-[10px] ml-2">
                      {excursion.public_enabled ? "Ativo" : "Pausado"}
                    </Badge>
                  )}
                  {publicUrl && (
                    <p className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-xs">{publicUrl}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {publicUrl ? (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => copyLink(publicUrl)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </Button>
                    </a>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={togglePublicEnabled}>
                      {excursion.public_enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="h-8 text-xs" onClick={generatePublicLink}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Gerar Link Público
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.shortLabel}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold rounded-full px-1.5 min-w-[1.25rem] h-4 flex items-center justify-center",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Seats ── */}
        <AnimatePresence mode="wait">
          {activeTab === "seats" && (
            <motion.div key="seats" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Armchair className="h-4 w-4" /> Mapa de Assentos
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        { label: "Disponível", cls: "bg-emerald-500/30 border-emerald-500/50" },
                        { label: "Vendido", cls: "bg-primary/30 border-primary/50" },
                        { label: "Reservado", cls: "bg-amber-500/30 border-amber-500/50" },
                        { label: "Bloqueado", cls: "bg-destructive/30 border-destructive/50" },
                      ].map(l => (
                        <span key={l.label} className="flex items-center gap-1 text-muted-foreground">
                          <span className={cn("w-2.5 h-2.5 rounded-sm border", l.cls)} />
                          <span className="hidden sm:inline">{l.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/20 rounded-xl p-3 sm:p-5 border">
                    {/* Bus front */}
                    <div className="flex justify-center mb-4">
                      <div className="w-20 h-7 rounded-t-2xl bg-muted/60 border border-b-0 flex items-center justify-center gap-1">
                        <Bus className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground font-medium">FRENTE</span>
                      </div>
                    </div>
                    {/* Seats grid */}
                    <div className="max-h-[420px] overflow-auto space-y-1.5 px-1">
                      {seatRows.map((row, ri) => (
                        <div key={ri} className="flex justify-center gap-1">
                          {row.map((sn, ci) => {
                            const seat = seats?.find((s) => s.seat_number === sn);
                            const status = seat?.blocked ? "BLOQUEADO" : seat?.status || "DISPONIVEL";
                            const isSelected = selectedSeats.includes(sn);
                            return (
                              <div key={sn} className="contents">
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => toggleSeat(sn)}
                                        className={cn(
                                          "w-10 h-10 sm:w-11 sm:h-11 rounded-lg border text-xs font-semibold transition-all duration-150",
                                          isSelected
                                            ? "bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/50 scale-105"
                                            : seatColors[status] || seatColors.DISPONIVEL
                                        )}
                                        disabled={status !== "DISPONIVEL"}
                                      >
                                        {sn}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      Assento {sn} — {status === "DISPONIVEL" ? "Disponível" : status === "VENDIDO" ? "Vendido" : status === "RESERVADO" ? "Reservado" : status === "BLOQUEADO" ? "Bloqueado" : status}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {ci === 1 && <div className="w-5 sm:w-6" />}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selection floating bar */}
                  <AnimatePresence>
                    {selectedSeats.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/20 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 rounded-lg p-2">
                              <Armchair className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {selectedSeats.length} assento{selectedSeats.length > 1 ? "s" : ""}: {selectedSeats.sort((a, b) => a - b).join(", ")}
                              </p>
                              <p className="text-lg font-bold text-primary">{formatCurrency(selectedSeats.length * excursion.seat_price_cents)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSeats([])}>Limpar</Button>
                            <Button size="sm" onClick={() => setSellOpen(true)}>
                              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Vender
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Tab: Sales ── */}
          {activeTab === "sales" && (
            <motion.div key="sales" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Vendas Balcão ({sales?.length || 0})</CardTitle>
                    {totalRevenue > 0 && (
                      <span className="text-sm font-bold text-primary">{formatCurrency(totalRevenue)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!sales || sales.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground mb-1">Nenhuma venda registrada</p>
                      <p className="text-xs text-muted-foreground/60">Selecione assentos no mapa para iniciar</p>
                    </div>
                  ) : isMobile ? (
                    <div className="space-y-2">
                      {sales.map((sale) => {
                        const PayIcon = paymentIcons[sale.payment_method] || DollarSign;
                        return (
                          <div key={sale.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="bg-primary/10 rounded-full p-1.5">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{sale.passengers?.name}</p>
                                  {sale.passengers?.document && (
                                    <p className="text-[11px] text-muted-foreground">{sale.passengers.document}</p>
                                  )}
                                </div>
                              </div>
                              <p className="font-bold text-sm tabular-nums">{formatCurrency(sale.amount_cents)}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {sale.seat_numbers.join(", ")}
                              </span>
                              <span className="flex items-center gap-1">
                                <PayIcon className="h-3 w-3" />
                                {sale.payment_method}
                              </span>
                              <Badge variant={sale.payment_status === "PAGO" ? "default" : "outline"} className="text-[9px] h-4">
                                {sale.payment_status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Passageiro</TableHead>
                            <TableHead>Assentos</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => {
                            const PayIcon = paymentIcons[sale.payment_method] || DollarSign;
                            return (
                              <TableRow key={sale.id}>
                                <TableCell>
                                  <p className="font-medium text-sm">{sale.passengers?.name}</p>
                                  {sale.passengers?.phone && (
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                      <Phone className="h-3 w-3" />{sale.passengers.phone}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm font-mono">{sale.seat_numbers.join(", ")}</span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <PayIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm">{sale.payment_method}</span>
                                    {sale.installments > 1 && (
                                      <span className="text-[10px] text-muted-foreground">({sale.installments}x)</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={sale.payment_status === "PAGO" ? "default" : "outline"} className="text-[10px]">
                                    {sale.payment_status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-sm">
                                  {formatCurrency(sale.amount_cents)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Tab: Affiliates ── */}
          {activeTab === "affiliates" && (
            <motion.div key="affiliates" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users2 className="h-4 w-4" /> Afiliados Vinculados
                    </CardTitle>
                    <Button size="sm" className="h-8 text-xs" onClick={() => setAffiliateOpen(true)} disabled={unlinkedAffiliates.length === 0}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Vincular
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!excursionAffiliates || excursionAffiliates.length === 0 ? (
                    <div className="text-center py-16">
                      <Users2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground mb-1">Nenhum afiliado vinculado</p>
                      <p className="text-xs text-muted-foreground/60 mb-4">Vincule afiliados para venda via link de indicação</p>
                      {unlinkedAffiliates.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setAffiliateOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Vincular Afiliado
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {excursionAffiliates.map((ea) => {
                        const aff = ea.affiliates;
                        const affUrl = publicUrl ? `${publicUrl}?ref=${ea.affiliate_token}` : null;
                        return (
                          <div key={ea.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/20 rounded-xl border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="bg-accent/10 rounded-full p-2 shrink-0">
                                <Users2 className="h-4 w-4 text-accent" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{aff?.name || "Afiliado"}</p>
                                {affUrl && <p className="text-[11px] font-mono text-muted-foreground/50 truncate">{affUrl}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {affUrl && (
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => copyLink(affUrl)}>
                                  <Copy className="h-3 w-3 mr-1" /> Copiar
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => unlinkAffiliate.mutate(ea.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Tab: Public Orders ── */}
          {activeTab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pedidos Online ({publicOrders?.length || 0})</CardTitle>
                    {onlineRevenue > 0 && (
                      <span className="text-sm font-bold text-primary">{formatCurrency(onlineRevenue)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!publicOrders || publicOrders.length === 0 ? (
                    <div className="text-center py-16">
                      <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground mb-1">Nenhum pedido online</p>
                      <p className="text-xs text-muted-foreground/60">
                        {publicUrl ? "Compartilhe o link público para receber pedidos" : "Gere um link público acima"}
                      </p>
                    </div>
                  ) : isMobile ? (
                    <div className="space-y-2">
                      {publicOrders.map((order: any) => {
                        const osCfg = orderStatusConfig[order.status] || { label: order.status, variant: "outline" as const };
                        return (
                          <div key={order.id} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{order.passenger_name}</p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />{order.passenger_phone}
                                </p>
                              </div>
                              <Badge variant={osCfg.variant} className="text-[10px] shrink-0">{osCfg.label}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Armchair className="h-3 w-3" />
                                {order.seat_numbers?.join(", ")}
                              </span>
                              <div className="text-right">
                                <p className="font-bold text-sm">{formatCurrency(order.amount_paid_cents)}</p>
                                {order.amount_pending_cents > 0 && (
                                  <p className="text-[10px] text-amber-500">{formatCurrency(order.amount_pending_cents)} pendente</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Passageiro</TableHead>
                            <TableHead>Assentos</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Pago</TableHead>
                            <TableHead className="text-right">Pendente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {publicOrders.map((order: any) => {
                            const osCfg = orderStatusConfig[order.status] || { label: order.status, variant: "outline" as const };
                            return (
                              <TableRow key={order.id}>
                                <TableCell>
                                  <p className="font-medium text-sm">{order.passenger_name}</p>
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />{order.passenger_phone}
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm font-mono">{order.seat_numbers?.join(", ")}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">{order.payment_type}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={osCfg.variant} className="text-[10px]">{osCfg.label}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm font-semibold">
                                  {formatCurrency(order.amount_paid_cents)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {order.amount_pending_cents > 0 ? (
                                    <span className="text-amber-500 font-medium">{formatCurrency(order.amount_pending_cents)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Info Card ── */}
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Detalhes da Excursão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Saída", value: depDate.toLocaleString("pt-BR"), icon: Calendar },
                retDate ? { label: "Retorno", value: retDate.toLocaleString("pt-BR"), icon: Calendar } : null,
                excursion.boarding_location ? { label: "Local de Embarque", value: excursion.boarding_location, icon: MapPin } : null,
                excursion.vehicles?.name ? { label: "Veículo", value: excursion.vehicles.name, icon: Bus } : null,
                { label: "Preço / Assento", value: formatCurrency(excursion.seat_price_cents), icon: DollarSign },
                { label: "Total de Assentos", value: `${excursion.total_seats}`, icon: Armchair },
                excursion.notes ? { label: "Observações", value: excursion.notes, icon: FileText } : null,
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/20">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Sell Dialog ── */}
        <Dialog open={sellOpen} onOpenChange={setSellOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Venda de Assento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do passageiro *</Label>
                <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={passengerDoc} onChange={(e) => setPassengerDoc(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Assentos selecionados</Label>
                <p className="text-sm font-semibold mt-1">
                  {selectedSeats.length > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Armchair className="h-4 w-4 text-primary" />
                      {selectedSeats.sort((a, b) => a - b).join(", ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nenhum — selecione no mapa</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DINHEIRO">💵 Dinheiro</SelectItem>
                      <SelectItem value="PIX">📱 PIX</SelectItem>
                      <SelectItem value="CARTAO">💳 Cartão</SelectItem>
                      <SelectItem value="BOLETO">📄 Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select value={installments} onValueChange={setInstallments}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-center">
                <p className="text-xs text-muted-foreground mb-1">Total da venda</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(selectedSeats.length * excursion.seat_price_cents)}</p>
                {parseInt(installments) > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {installments}x de {formatCurrency(Math.round((selectedSeats.length * excursion.seat_price_cents) / parseInt(installments)))}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSellOpen(false)}>Cancelar</Button>
              <Button onClick={handleSell} disabled={!passengerName || selectedSeats.length === 0 || sellTicket.isPending}>
                {sellTicket.isPending ? "Processando..." : "Confirmar Venda"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Link Affiliate Dialog ── */}
        <Dialog open={affiliateOpen} onOpenChange={setAffiliateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users2 className="h-5 w-5 text-accent" />
                Vincular Afiliado
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Afiliado</Label>
                <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {unlinkedAffiliates.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAffiliateOpen(false)}>Cancelar</Button>
              <Button onClick={handleLinkAffiliate} disabled={!selectedAffiliate || linkAffiliate.isPending}>Vincular</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
