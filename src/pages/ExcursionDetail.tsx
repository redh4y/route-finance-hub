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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const seatColors: Record<string, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer",
  RESERVADO: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  VENDIDO: "bg-primary/20 text-primary border-primary/40",
  CANCELADO: "bg-muted text-muted-foreground border-muted",
  BLOQUEADO: "bg-destructive/20 text-destructive border-destructive/40",
};

const statusBadgeConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  RASCUNHO: { label: "Rascunho", variant: "outline" },
  EM_VENDA: { label: "Em Venda", variant: "default" },
  LOTADA: { label: "Lotada", variant: "destructive" },
  FINALIZADA: { label: "Finalizada", variant: "secondary" },
  CANCELADA: { label: "Cancelada", variant: "outline" },
};

export default function ExcursionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
            <div className="grid grid-cols-5 gap-3 mt-8">
              {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-muted rounded" />)}
            </div>
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
  const availableSeats = (seats || []).filter((s) => s.status === "DISPONIVEL" && !s.blocked).length;
  const occupancy = excursion.total_seats > 0 ? Math.round(((soldSeats + reservedSeats) / excursion.total_seats) * 100) : 0;
  const totalRevenue = (sales || []).reduce((sum, s) => sum + s.amount_cents, 0);
  const statusCfg = statusBadgeConfig[excursion.status] || statusBadgeConfig.RASCUNHO;

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
    { key: "seats" as const, label: "Mapa", icon: Armchair },
    { key: "sales" as const, label: "Vendas", icon: ShoppingCart, count: sales?.length },
    { key: "affiliates" as const, label: "Afiliados", icon: Users2, count: excursionAffiliates?.length },
    { key: "orders" as const, label: "Pedidos Online", icon: DollarSign, count: publicOrders?.length },
  ];

  return (
    <MainLayout>
      <PageTransition>
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/excursoes")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="page-title">{excursion.name}</h1>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </div>
                <p className="page-subtitle flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {excursion.destination}{excursion.destination_state ? `/${excursion.destination_state}` : ""}
                  <span className="text-muted-foreground/40 mx-1">·</span>
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(excursion.departure_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
              <Button onClick={() => setSellOpen(true)} disabled={excursion.status === "CANCELADA" || excursion.status === "FINALIZADA"} size="sm">
                <ShoppingCart className="h-4 w-4 mr-1.5" />
                Vender
              </Button>
            </div>
          </div>
        </div>

        {/* Public Link */}
        <Card className="mb-5">
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Link Público</span>
                {excursion.public_token && (
                  <Badge variant={excursion.public_enabled ? "default" : "outline"} className="text-[10px]">
                    {excursion.public_enabled ? "Ativo" : "Pausado"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {publicUrl ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyLink(publicUrl)}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </Button>
                    </a>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={togglePublicEnabled}>
                      {excursion.public_enabled ? "Pausar" : "Ativar"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="h-7 text-xs" onClick={generatePublicLink}>
                    <Link2 className="h-3 w-3 mr-1" /> Gerar Link
                  </Button>
                )}
              </div>
            </div>
            {publicUrl && <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-mono break-all">{publicUrl}</p>}
          </CardContent>
        </Card>

        {/* Stats with progress bar */}
        <div className="mb-5">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-3">
            {[
              { label: "Ocupação", value: `${occupancy}%`, icon: Users, color: "text-accent" },
              { label: "Vendidos", value: soldSeats, icon: CheckCircle2, color: "text-success" },
              { label: "Reservados", value: reservedSeats, icon: Clock, color: "text-warning" },
              { label: "Disponíveis", value: availableSeats, icon: Armchair, color: "text-muted-foreground" },
              { label: "Receita", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-primary" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2">
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                      <div>
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold leading-tight">{s.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <Progress value={occupancy} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">{soldSeats + reservedSeats}/{excursion.total_seats} assentos ocupados</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={activeTab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(t.key)}
              className="shrink-0"
            >
              <t.icon className="h-3.5 w-3.5 mr-1.5" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[1.25rem]">{t.count}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Tab: Seats */}
        {activeTab === "seats" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Armchair className="h-4 w-4" /> Mapa de Assentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" /> Disponível</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/30 border border-primary/50" /> Vendido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50" /> Reservado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/30 border border-destructive/50" /> Bloqueado</span>
                {selectedSeats.length > 0 && (
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 border border-blue-400" /> Selecionado</span>
                )}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-6 rounded-t-xl bg-muted border border-b-0 flex items-center justify-center text-[10px] text-muted-foreground">FRENTE</div>
                </div>
                <div className="max-h-[400px] overflow-auto space-y-1.5">
                  {seatRows.map((row, ri) => (
                    <div key={ri} className="flex justify-center gap-1">
                      {row.map((sn, ci) => {
                        const seat = seats?.find((s) => s.seat_number === sn);
                        const status = seat?.blocked ? "BLOQUEADO" : seat?.status || "DISPONIVEL";
                        const isSelected = selectedSeats.includes(sn);
                        return (
                          <div key={sn} className="contents">
                            <button
                              onClick={() => toggleSeat(sn)}
                              className={cn(
                                "w-10 h-10 rounded border text-xs font-medium transition-all",
                                isSelected ? "bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/50" : seatColors[status] || seatColors.DISPONIVEL
                              )}
                              disabled={status !== "DISPONIVEL"}
                            >
                              {sn}
                            </button>
                            {ci === 1 && <div className="w-4" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {selectedSeats.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm"><strong>{selectedSeats.length}</strong> assento(s): {selectedSeats.sort((a, b) => a - b).join(", ")}</p>
                      <p className="text-sm font-bold mt-0.5">{formatCurrency(selectedSeats.length * excursion.seat_price_cents)}</p>
                    </div>
                    <Button size="sm" onClick={() => setSellOpen(true)}>
                      <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Vender
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab: Sales */}
        {activeTab === "sales" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vendas ({sales?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!sales || sales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma venda ainda</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Passageiro</TableHead>
                        <TableHead>Assentos</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{sale.passengers?.name}</p>
                            {sale.passengers?.document && <p className="text-xs text-muted-foreground">{sale.passengers.document}</p>}
                          </TableCell>
                          <TableCell className="text-sm">{sale.seat_numbers.join(", ")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{sale.payment_method}</Badge>
                            <Badge variant={sale.payment_status === "PAGO" ? "default" : "outline"} className="text-[10px] ml-1">{sale.payment_status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm">{formatCurrency(sale.amount_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab: Affiliates */}
        {activeTab === "affiliates" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><Users2 className="h-4 w-4" /> Afiliados Vinculados</CardTitle>
                <Button size="sm" className="h-7 text-xs" onClick={() => setAffiliateOpen(true)} disabled={unlinkedAffiliates.length === 0}>
                  <Plus className="h-3 w-3 mr-1" /> Vincular
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!excursionAffiliates || excursionAffiliates.length === 0 ? (
                <div className="text-center py-12">
                  <Users2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum afiliado vinculado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {excursionAffiliates.map((ea) => {
                    const aff = ea.affiliates;
                    const affUrl = publicUrl ? `${publicUrl}?ref=${ea.affiliate_token}` : null;
                    return (
                      <div key={ea.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{aff?.name || "Afiliado"}</p>
                          {affUrl && <p className="text-[11px] font-mono text-muted-foreground/60 break-all">{affUrl}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {affUrl && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyLink(affUrl)}>
                              <Copy className="h-3 w-3 mr-1" /> Copiar
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => unlinkAffiliate.mutate(ea.id)}>
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
        )}

        {/* Tab: Public Orders */}
        {activeTab === "orders" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pedidos Online ({publicOrders?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!publicOrders || publicOrders.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido online</p>
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
                      {publicOrders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{order.passenger_name}</p>
                            <p className="text-xs text-muted-foreground">{order.passenger_phone}</p>
                          </TableCell>
                          <TableCell className="text-sm">{order.seat_numbers?.join(", ")}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{order.payment_type}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={order.status === "VENDIDO" ? "default" : order.status === "RESERVADO" ? "secondary" : "outline"} className="text-[10px]">
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency(order.amount_paid_cents)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-warning">
                            {order.amount_pending_cents > 0 ? formatCurrency(order.amount_pending_cents) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info card */}
        <Card className="mt-5">
          <CardHeader className="pb-3"><CardTitle className="text-base">Informações</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Saída</p>
                <p className="font-medium">{new Date(excursion.departure_at).toLocaleString("pt-BR")}</p>
              </div>
              {excursion.return_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Retorno</p>
                  <p className="font-medium">{new Date(excursion.return_at).toLocaleString("pt-BR")}</p>
                </div>
              )}
              {excursion.boarding_location && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Local embarque</p>
                  <p className="font-medium">{excursion.boarding_location}</p>
                </div>
              )}
              {excursion.vehicles?.name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Veículo</p>
                  <p className="font-medium">{excursion.vehicles.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Preço/assento</p>
                <p className="font-medium">{formatCurrency(excursion.seat_price_cents)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sell Dialog */}
        <Dialog open={sellOpen} onOpenChange={setSellOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Venda de Assento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do passageiro *</Label>
                <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>CPF</Label><Input value={passengerDoc} onChange={(e) => setPassengerDoc(e.target.value)} placeholder="000.000.000-00" /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
              <div className="p-2.5 rounded-lg bg-muted/50 border">
                <Label className="text-xs text-muted-foreground">Assentos selecionados</Label>
                <p className="text-sm font-semibold mt-0.5">{selectedSeats.length > 0 ? selectedSeats.sort((a, b) => a - b).join(", ") : "Nenhum — selecione no mapa"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
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
              <div className="p-3 bg-success/5 border border-success/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-success">{formatCurrency(selectedSeats.length * excursion.seat_price_cents)}</p>
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

        {/* Link Affiliate Dialog */}
        <Dialog open={affiliateOpen} onOpenChange={setAffiliateOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Vincular Afiliado</DialogTitle></DialogHeader>
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
