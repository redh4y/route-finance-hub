import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, Download, Eye, FileText, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDateShort(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

type AccessLog = {
  id: string;
  created_at: string;
  action: "SEARCH" | "DOWNLOAD";
  cpf_digits: string;
  reference_month: string | null;
  student_name: string | null;
  drive_url: string | null;
  found_count: number | null;
  source: string;
  user_agent: string | null;
  _from_payers?: boolean;
};

const PAGE_SIZE = 50;

export default function BoletoAccessLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: result, isLoading } = useQuery({
    queryKey: ["public-boleto-access-logs", search, actionFilter, page],
    queryFn: async () => {
      let query = (supabase as any)
        .from("public_boleto_access_logs")
        .select(
          "id,created_at,action,cpf_digits,reference_month,student_name,drive_url,found_count,source,user_agent",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.or(
          `cpf_digits.ilike.%${search}%,student_name.ilike.%${search}%,reference_month.ilike.%${search}%`,
        );
      }

      if (actionFilter !== "ALL") {
        query = query.eq("action", actionFilter);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const logs = (data || []) as AccessLog[];

      // Enrich: cross-reference CPFs without student_name against payers table
      const cpfsWithoutName = Array.from(
        new Set(logs.filter((r) => !r.student_name).map((r) => r.cpf_digits)),
      );

      const payerMap = new Map<string, string>();

      if (cpfsWithoutName.length > 0) {
        const { data: payers } = await supabase
          .from("payers")
          .select("document_digits, name")
          .in("document_digits", cpfsWithoutName);

        for (const p of payers || []) {
          if (p.document_digits) payerMap.set(p.document_digits, p.name);
        }
      }

      const enriched = logs.map((row) => ({
        ...row,
        student_name: row.student_name || payerMap.get(row.cpf_digits) || null,
        _from_payers: !row.student_name && payerMap.has(row.cpf_digits),
      }));

      return { rows: enriched, count: count || 0 };
    },
  });

  // Stats query (totals)
  const { data: stats } = useQuery({
    queryKey: ["public-boleto-access-logs-stats"],
    queryFn: async () => {
      const [totalRes, searchRes, downloadRes, todayRes] = await Promise.all([
        (supabase as any).from("public_boleto_access_logs").select("id", { count: "exact", head: true }),
        (supabase as any).from("public_boleto_access_logs").select("id", { count: "exact", head: true }).eq("action", "SEARCH"),
        (supabase as any).from("public_boleto_access_logs").select("id", { count: "exact", head: true }).eq("action", "DOWNLOAD"),
        (supabase as any).from("public_boleto_access_logs").select("id", { count: "exact", head: true }).gte("created_at", new Date().toISOString().slice(0, 10)),
      ]);
      return {
        total: totalRes.count || 0,
        searches: searchRes.count || 0,
        downloads: downloadRes.count || 0,
        today: todayRes.count || 0,
      };
    },
    staleTime: 30_000,
  });

  const rows = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Numbered pagination
  const maxVisible = 5;
  const half = Math.floor(maxVisible / 2);
  let startPage = Math.max(1, page - half);
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Logs · 2ª via de boletos</h1>
            <p className="page-subtitle">
              Auditoria de consultas e downloads realizados no portal público.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de acessos</p>
                  <p className="text-xl font-bold">{stats?.total?.toLocaleString("pt-BR") ?? "–"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2.5">
                  <Search className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consultas</p>
                  <p className="text-xl font-bold">{stats?.searches?.toLocaleString("pt-BR") ?? "–"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2.5">
                  <Download className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Downloads</p>
                  <p className="text-xl font-bold">{stats?.downloads?.toLocaleString("pt-BR") ?? "–"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2.5">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                  <p className="text-xl font-bold">{stats?.today?.toLocaleString("pt-BR") ?? "–"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 max-w-sm">
                  <Label className="text-xs mb-1.5 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="CPF, competência ou aluno"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-44">
                  <Label className="text-xs mb-1.5 block">Ação</Label>
                  <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas</SelectItem>
                      <SelectItem value="SEARCH">Consulta</SelectItem>
                      <SelectItem value="DOWNLOAD">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Registros</CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {total.toLocaleString("pt-BR")}
              </Badge>
            </CardHeader>
            <CardContent className="px-0">
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Data/hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Resultados</TableHead>
                      <TableHead className="pr-6">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                          Nenhum log encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => (
                      <TableRow key={row.id} className="group">
                        <TableCell className="pl-6 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                        <TableCell>
                          {row.action === "DOWNLOAD" ? (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 gap-1 text-[11px]">
                              <Download className="h-3 w-3" />
                              Download
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              <Search className="h-3 w-3" />
                              Consulta
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs tracking-wide">
                          {row.cpf_digits}
                        </TableCell>
                        <TableCell className="text-sm">{row.reference_month || "–"}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {row.student_name ? (
                            <span className="flex items-center gap-1.5">
                              {row.student_name}
                              {row._from_payers && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal text-muted-foreground">
                                  cadastro
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.found_count != null ? (
                            <Badge
                              variant={row.found_count === 0 ? "destructive" : "secondary"}
                              className="text-[11px]"
                            >
                              {row.found_count}
                            </Badge>
                          ) : (
                            "–"
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          {row.drive_url ? (
                            <a
                              href={row.drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-2 px-6">
                  <p className="text-xs text-muted-foreground">
                    {from + 1}–{Math.min(from + PAGE_SIZE, total)} de{" "}
                    {total.toLocaleString("pt-BR")} · Página {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {startPage > 1 && (
                      <span className="text-xs text-muted-foreground px-1">…</span>
                    )}
                    {pageNumbers.map((n) => (
                      <Button
                        key={n}
                        variant={n === page ? "default" : "ghost"}
                        size="icon"
                        className="h-8 w-8 text-xs"
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </Button>
                    ))}
                    {endPage < totalPages && (
                      <span className="text-xs text-muted-foreground px-1">…</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
