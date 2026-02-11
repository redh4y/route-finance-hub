import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatMonthRef, getCurrentMonthRef } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Download, FileText, BarChart3, Bus, Truck, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

export default function Reports() {
  const [tab, setTab] = useState("dre");

  return (
    <MainLayout>
      <PageTransition>
      <div className="page-header">
        <h1 className="page-title">Relat?rios</h1>
        <p className="page-subtitle">An?lises financeiras, excurs?es e ve?culos</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="dre" className="gap-2">
            <FileText className="h-4 w-4" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="mensal" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Mensal
          </TabsTrigger>
          <TabsTrigger value="excursoes" className="gap-2">
            <Bus className="h-4 w-4" />
            Excurs?es
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-2">
            <Truck className="h-4 w-4" />
            Ve?culos
          </TabsTrigger>
          <TabsTrigger value="afiliados" className="gap-2">
            <Users2 className="h-4 w-4" />
            Afiliados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dre"><DREReport /></TabsContent>
        <TabsContent value="mensal"><MonthlyReport /></TabsContent>
        <TabsContent value="excursoes"><ExcursionsReport /></TabsContent>
        <TabsContent value="veiculos"><VehiclesReport /></TabsContent>
        <TabsContent value="afiliados"><AffiliatesReport /></TabsContent>
      </Tabs>
          </PageTransition>
</MainLayout>
  );
}

function DREReport() {
  const [month, setMonth] = useState(getCurrentMonthRef());
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: entries } = useQuery({
    queryKey: ["report-dre", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("type, category, amount_cents, cost_type")
        .eq("competence_month", month);
      if (error) throw error;
      return data as { type: string; category: string; amount_cents: number; cost_type: string | null }[];
    },
  });

  const revenue = (entries || []).filter((e) => e.type === "RECEITA").reduce((s, e) => s + e.amount_cents, 0);
  const costs = (entries || []).filter((e) => e.type === "DESPESA" && e.cost_type === "CUSTO").reduce((s, e) => s + e.amount_cents, 0);
  const expenses = (entries || []).filter((e) => e.type === "DESPESA" && e.cost_type !== "CUSTO").reduce((s, e) => s + e.amount_cents, 0);
  const profit = revenue - costs - expenses;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    (entries || []).forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount_cents);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{formatMonthRef(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Receita</p><p className="text-xl font-bold text-emerald-400">{formatCurrency(revenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Custos</p><p className="text-xl font-bold text-red-400">{formatCurrency(costs)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Despesas</p><p className="text-xl font-bold text-amber-400">{formatCurrency(expenses)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resultado</p><p className={`text-xl font-bold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(profit)}</p></CardContent></Card>
      </div>

      {byCategory.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MonthlyReport() {
  const { data: entries } = useQuery({
    queryKey: ["report-monthly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("competence_month, type, amount_cents, cost_type");
      if (error) throw error;
      return data as { competence_month: string; type: string; amount_cents: number; cost_type: string | null }[];
    },
  });

  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; costs: number; expenses: number }>();
    (entries || []).forEach((e) => {
      const m = e.competence_month;
      if (!map.has(m)) map.set(m, { revenue: 0, costs: 0, expenses: 0 });
      const row = map.get(m)!;
      if (e.type === "RECEITA") row.revenue += e.amount_cents;
      else if (e.cost_type === "CUSTO") row.costs += e.amount_cents;
      else row.expenses += e.amount_cents;
    });
    return Array.from(map.entries())
      .map(([month, data]) => ({
        month: formatMonthRef(month),
        receita: data.revenue / 100,
        custos: data.costs / 100,
        despesas: data.expenses / 100,
        resultado: (data.revenue - data.costs - data.expenses) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [entries]);

  return (
    <div className="space-y-6">
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Comparativo Mensal</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} name="Receita" />
                  <Line type="monotone" dataKey="custos" stroke="#ef4444" strokeWidth={2} name="Custos" />
                  <Line type="monotone" dataKey="resultado" stroke="hsl(var(--primary))" strokeWidth={2} name="Resultado" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {monthlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Tabela Mensal</CardTitle></CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>M?s</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custos</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right text-emerald-400">R$ {row.receita.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-400">R$ {row.custos.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-amber-400">R$ {row.despesas.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.resultado >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      R$ {row.resultado.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExcursionsReport() {
  const { data: excursions } = useQuery({
    queryKey: ["report-excursions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("id, name, destination, total_seats, seat_price_cents, status, departure_at")
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string; destination: string; total_seats: number; seat_price_cents: number; status: string; departure_at: string }[];
    },
  });

  const { data: allSales } = useQuery({
    queryKey: ["report-all-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_sales")
        .select("excursion_id, amount_cents, seat_numbers, payment_status");
      if (error) throw error;
      return data as { excursion_id: string; amount_cents: number; seat_numbers: number[]; payment_status: string }[];
    },
  });

  const reportData = useMemo(() => {
    return (excursions || []).map((exc) => {
      const sales = (allSales || []).filter((s) => s.excursion_id === exc.id);
      const soldSeats = sales.reduce((sum, s) => sum + s.seat_numbers.length, 0);
      const revenue = sales.reduce((sum, s) => sum + s.amount_cents, 0);
      const occupancy = exc.total_seats > 0 ? Math.round((soldSeats / exc.total_seats) * 100) : 0;
      const ticketMedio = soldSeats > 0 ? revenue / soldSeats : 0;
      return {
        ...exc,
        soldSeats,
        revenue,
        occupancy,
        ticketMedio,
        passengers: sales.length,
      };
    });
  }, [excursions, allSales]);

  return (
    <div className="space-y-6">
      {reportData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma excurs?o cadastrada</div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Relat?rio por Excurs?o</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Excurs?o</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Vendidos</TableHead>
                    <TableHead className="text-right">Ocupa??o</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket M?dio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.destination}</TableCell>
                      <TableCell>{new Date(r.departure_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{r.soldSeats}/{r.total_seats}</TableCell>
                      <TableCell className="text-right">{r.occupancy}%</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.revenue)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.ticketMedio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ocupa??o por Excurs?o</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="occupancy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ocupa??o" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function VehiclesReport() {
  const { data: vehicles } = useQuery({
    queryKey: ["report-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate")
        .eq("active", true);
      if (error) throw error;
      return data as { id: string; name: string; plate: string | null }[];
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["report-vehicle-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("vehicle_id, type, amount_cents")
        .not("vehicle_id", "is", null);
      if (error) throw error;
      return data as { vehicle_id: string; type: string; amount_cents: number }[];
    },
  });

  const reportData = useMemo(() => {
    return (vehicles || []).map((v) => {
      const vEntries = (entries || []).filter((e) => e.vehicle_id === v.id);
      const revenue = vEntries.filter((e) => e.type === "RECEITA").reduce((s, e) => s + e.amount_cents, 0);
      const costs = vEntries.filter((e) => e.type === "DESPESA").reduce((s, e) => s + e.amount_cents, 0);
      return {
        name: v.name,
        plate: v.plate,
        revenue,
        costs,
        result: revenue - costs,
      };
    }).filter((v) => v.revenue > 0 || v.costs > 0);
  }, [vehicles, entries]);

  return (
    <div className="space-y-6">
      {reportData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum dado de ve?culo dispon?vel. Vincule lan?amentos financeiros a ve?culos para ver este relat?rio.
        </div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Custos e Receitas por Ve?culo</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ve?culo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Custos</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.plate || "-"}</TableCell>
                      <TableCell className="text-right text-emerald-400 font-mono">{formatCurrency(r.revenue)}</TableCell>
                      <TableCell className="text-right text-red-400 font-mono">{formatCurrency(r.costs)}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${r.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatCurrency(r.result)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gr?fico por Ve?culo</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Receita" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costs" fill="#ef4444" name="Custos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AffiliatesReport() {
  const { data: commissions } = useQuery({
    queryKey: ["report-affiliate-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_commissions")
        .select("*, affiliates(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: excursions } = useQuery({
    queryKey: ["report-affiliate-excursions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("id, name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const byAffiliate = useMemo(() => {
    const map = new Map<string, { name: string; total: number; confirmed: number; pending: number; count: number }>();
    (commissions || []).forEach((c: any) => {
      const name = c.affiliates?.name || "Desconhecido";
      if (!map.has(c.affiliate_id)) {
        map.set(c.affiliate_id, { name, total: 0, confirmed: 0, pending: 0, count: 0 });
      }
      const row = map.get(c.affiliate_id)!;
      row.total += c.commission_cents;
      row.count += 1;
      if (c.status === "CONFIRMADA" || c.status === "PAGA") row.confirmed += c.commission_cents;
      else row.pending += c.commission_cents;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [commissions]);

  const excursionName = (id: string) => excursions?.find((e) => e.id === id)?.name || "-";

  return (
    <div className="space-y-6">
      {/* Summary by affiliate */}
      <Card>
        <CardHeader><CardTitle>Comiss?es por Afiliado</CardTitle></CardHeader>
        <CardContent>
          {byAffiliate.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma comiss?o registrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Comiss?o Total</TableHead>
                  <TableHead className="text-right">Confirmada</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byAffiliate.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(row.total)}</TableCell>
                    <TableCell className="text-right font-mono text-primary">{formatCurrency(row.confirmed)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-400">{formatCurrency(row.pending)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail table */}
      {(commissions || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Detalhamento de Comiss?es</CardTitle></CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Excurs?o</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Comiss?o</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(commissions || []).slice(0, 50).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{c.affiliates?.name}</TableCell>
                    <TableCell className="text-sm">{excursionName(c.excursion_id)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(c.amount_sold_cents)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(c.commission_cents)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        c.status === "CONFIRMADA" ? "bg-primary/20 text-primary" :
                        c.status === "PAGA" ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-amber-500/20 text-amber-400"
                      )}>
                        {c.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {byAffiliate.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Comiss?o por Afiliado</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAffiliate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="confirmed" fill="hsl(var(--primary))" name="Confirmada" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pendente" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

