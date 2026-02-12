import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

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
const statusVariant = (status: LeadStatus) => {
  if (status === "CONVERTIDO") return "default" as const;
  if (status === "ABANDONADO") return "destructive" as const;
  return "outline" as const;
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");

  const { data: leads, isLoading } = useQuery({
    queryKey: ["public-excursion-leads"],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("public_excursion_leads")
        .select(`id,created_at,status,name,cpf_digits,phone_digits,email,source,ref_code,seat_count,amount_total_cents,payment_type,order_id,excursions(name,destination,departure_at),affiliates(name)`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as PublicLeadRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (leads || []).filter((l) => {
      const byStatus = statusFilter === "ALL" || l.status === statusFilter;
      const haystack = [l.name, l.cpf_digits, l.phone_digits, l.email || "", l.excursions?.name || "", l.excursions?.destination || "", l.affiliates?.name || ""].join(" ").toLowerCase();
      return byStatus && (!q || haystack.includes(q));
    });
  }, [leads, search, statusFilter]);

  const stats = useMemo(() => {
    const rows = leads || [];
    return { total: rows.length, capturados: rows.filter((r) => r.status === "CAPTURADO").length, pixGerado: rows.filter((r) => r.status === "PIX_GERADO").length, convertidos: rows.filter((r) => r.status === "CONVERTIDO").length };
  }, [leads]);

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Leads de Excursões</h1>
          <p className="page-subtitle">Acompanhamento do funil público de reserva e pagamento</p>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
          <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Capturados</p><p className="text-2xl font-bold">{stats.capturados}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">PIX gerado</p><p className="text-2xl font-bold">{stats.pixGerado}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Convertidos</p><p className="text-2xl font-bold text-success">{stats.convertidos}</p></CardContent></Card>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <Input placeholder="Buscar por nome, CPF, telefone, excursão ou afiliado..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "ALL")}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos status</SelectItem>
                  <SelectItem value="CAPTURADO">Capturado</SelectItem>
                  <SelectItem value="INTERESSE_ASSENTOS">Interesse assentos</SelectItem>
                  <SelectItem value="PIX_GERADO">PIX gerado</SelectItem>
                  <SelectItem value="RESERVADO">Reservado</SelectItem>
                  <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                  <SelectItem value="ABANDONADO">Abandonado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">Carregando leads...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">Nenhum lead encontrado</div>
            ) : (
              <>
                {/* Mobile: Card list */}
                <div className="lg:hidden space-y-3">
                  {filtered.map((l) => (
                    <div key={l.id} className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{l.name}</span>
                        <Badge variant={statusVariant(l.status)} className="text-xs shrink-0">{l.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCpf(l.cpf_digits)} · {formatPhone(l.phone_digits)}
                      </div>
                      {l.excursions && (
                        <div className="text-xs text-muted-foreground">
                          {l.excursions.name} — {l.excursions.destination}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{l.source}{l.affiliates?.name ? ` · ${l.affiliates.name}` : ""}</span>
                        <span className="font-mono font-medium">{formatCurrency(l.amount_total_cents || 0)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
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
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>
                            <div className="font-medium">{l.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCpf(l.cpf_digits)} · {formatPhone(l.phone_digits)}</div>
                            {l.email && <div className="text-xs text-muted-foreground">{l.email}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{l.excursions?.name || "-"}</div>
                            <div className="text-xs text-muted-foreground">{l.excursions?.destination || "-"}</div>
                          </TableCell>
                          <TableCell><Badge variant={statusVariant(l.status)}>{l.status}</Badge></TableCell>
                          <TableCell className="text-sm">{l.payment_type || "-"}{l.order_id ? <div className="text-xs text-muted-foreground">Pedido vinculado</div> : null}</TableCell>
                          <TableCell className="text-sm">{l.source}{l.affiliates?.name ? <div className="text-xs text-muted-foreground">Afiliado: {l.affiliates.name}</div> : null}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(l.amount_total_cents || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageTransition>
    </MainLayout>
  );
}
