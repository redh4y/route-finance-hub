import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search, UserCheck, Zap, Eye, UserX, Users, Crosshair } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

type LeadStatus = "CAPTURADO" | "INTERESSE_ASSENTOS" | "PIX_GERADO" | "RESERVADO" | "CONVERTIDO" | "ABANDONADO";

type PublicLeadRow = {
  id: string;
  created_at: string;
  status: LeadStatus;
  name: string;
  cpf_digits: string;
  phone_digits: string;
  email: string | null;
  source: string;
  ref_code: string | null;
  seat_count: number;
  amount_total_cents: number;
  payment_type: "TOTAL" | "PARCIAL" | null;
  order_id: string | null;
  excursions?: { name: string; destination: string; departure_at: string } | null;
  affiliates?: { name: string } | null;
};

const formatCpf = (digits: string) => {
  const d = (digits || "").replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
};
const formatPhone = (digits: string) => {
  const d = (digits || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const statusConfig: Record<LeadStatus, { label: string; variant: "default" | "destructive" | "outline" | "secondary"; color: string }> = {
  CAPTURADO: { label: "Capturado", variant: "outline", color: "text-muted-foreground" },
  INTERESSE_ASSENTOS: { label: "Interesse", variant: "outline", color: "text-accent" },
  PIX_GERADO: { label: "PIX Gerado", variant: "secondary", color: "text-warning" },
  RESERVADO: { label: "Reservado", variant: "secondary", color: "text-accent" },
  CONVERTIDO: { label: "Convertido", variant: "default", color: "text-success" },
  ABANDONADO: { label: "Abandonado", variant: "destructive", color: "text-destructive" },
};

const PAGE_SIZE = 50;

type FilterStatus = LeadStatus | "ALL";
const filterTabs: { value: FilterStatus; label: string; icon: typeof Users }[] = [
  { value: "ALL", label: "Todos", icon: Users },
  { value: "CAPTURADO", label: "Capturado", icon: Crosshair },
  { value: "PIX_GERADO", label: "PIX Gerado", icon: Zap },
  { value: "RESERVADO", label: "Reservado", icon: Eye },
  { value: "CONVERTIDO", label: "Convertido", icon: UserCheck },
  { value: "ABANDONADO", label: "Abandonado", icon: UserX },
];

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [page, setPage] = useState(1);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: result, isLoading } = useQuery({
    queryKey: ["public-excursion-leads", statusFilter, search, page],
    queryFn: async () => {
      const sb = supabase as any;
      let query = sb
        .from("public_excursion_leads")
        .select(`id,created_at,status,name,cpf_digits,phone_digits,email,source,ref_code,seat_count,amount_total_cents,payment_type,order_id,excursions(name,destination,departure_at),affiliates(name)`, { count: "exact" })
        .order("created_at", { ascending: false });
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search}%,cpf_digits.ilike.%${search}%,phone_digits.ilike.%${search}%,email.ilike.%${search}%`
        );
      }
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { rows: (data || []) as PublicLeadRow[], count: count || 0 };
    },
  });

  const leads = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: stats = { total: 0, capturados: 0, pixGerado: 0, convertidos: 0, abandonados: 0 } } = useQuery({
    queryKey: ["public-excursion-leads-stats"],
    queryFn: async () => {
      const sb = supabase as any;
      const [
        { count: totalCount },
        { count: capturados },
        { count: pixGerado },
        { count: convertidos },
        { count: abandonados },
      ] = await Promise.all([
        sb.from("public_excursion_leads").select("id", { count: "exact", head: true }),
        sb.from("public_excursion_leads").select("id", { count: "exact", head: true }).eq("status", "CAPTURADO"),
        sb.from("public_excursion_leads").select("id", { count: "exact", head: true }).eq("status", "PIX_GERADO"),
        sb.from("public_excursion_leads").select("id", { count: "exact", head: true }).eq("status", "CONVERTIDO"),
        sb.from("public_excursion_leads").select("id", { count: "exact", head: true }).eq("status", "ABANDONADO"),
      ]);
      return { total: totalCount || 0, capturados: capturados || 0, pixGerado: pixGerado || 0, convertidos: convertidos || 0, abandonados: abandonados || 0 };
    },
  });

  const conversionRate = stats.total > 0 ? ((stats.convertidos / stats.total) * 100).toFixed(1) : "0";

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: Users, color: "text-accent" },
    { label: "Capturados", value: stats.capturados, icon: Crosshair, color: "text-muted-foreground" },
    { label: "PIX Gerado", value: stats.pixGerado, icon: Zap, color: "text-warning" },
    { label: "Convertidos", value: stats.convertidos, icon: UserCheck, color: "text-success" },
  ];

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="page-title">Leads de Excursões</h1>
              <p className="page-subtitle">Funil de reserva e pagamento público</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm px-3 py-1">
                Taxa de conversão: <span className="font-bold text-success ml-1">{conversionRate}%</span>
              </Badge>
            </div>
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
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF, telefone ou email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <Button
                  key={tab.value}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                  className="shrink-0"
                >
                  <tab.icon className="h-3.5 w-3.5 mr-1.5" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-4 items-center p-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum lead encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Os leads aparecem quando visitantes acessam excursões públicas</p>
              </div>
            ) : (
              <>
                {/* Mobile: Card list */}
                <div className="lg:hidden space-y-2">
                  {leads.map((l) => {
                    const cfg = statusConfig[l.status];
                    return (
                      <div key={l.id} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{l.name}</span>
                          <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCpf(l.cpf_digits)} · {formatPhone(l.phone_digits)}
                        </div>
                        {l.excursions && (
                          <div className="text-xs text-muted-foreground truncate">
                            {l.excursions.name} — {l.excursions.destination}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {l.seat_count} assento(s)
                            {l.affiliates?.name ? ` · ${l.affiliates.name}` : ""}
                          </span>
                          <span className="font-mono font-semibold">{formatCurrency(l.amount_total_cents || 0)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/60">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
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
                        <TableHead>Data</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Excursão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Assentos</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((l) => {
                        const cfg = statusConfig[l.status];
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {new Date(l.created_at).toLocaleDateString("pt-BR")}
                              <div className="text-[11px] text-muted-foreground/60">
                                {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{l.name}</div>
                              <div className="text-xs text-muted-foreground">{formatCpf(l.cpf_digits)} · {formatPhone(l.phone_digits)}</div>
                              {l.email && <div className="text-xs text-muted-foreground/60">{l.email}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{l.excursions?.name || "-"}</div>
                              <div className="text-xs text-muted-foreground">{l.excursions?.destination || "-"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                              {l.order_id && <div className="text-[10px] text-success mt-0.5">Pedido vinculado</div>}
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium">{l.seat_count}</TableCell>
                            <TableCell className="text-sm">
                              {l.source}
                              {l.affiliates?.name && (
                                <div className="text-xs text-muted-foreground">Afiliado: {l.affiliates.name}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-sm">{formatCurrency(l.amount_total_cents || 0)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-xs text-muted-foreground">
                    {total} lead{total !== 1 ? "s" : ""} · Página {page}/{totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageTransition>
    </MainLayout>
  );
}
