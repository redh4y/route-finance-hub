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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  Eye,
  FileText,
  Activity,
  Users,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDateShort(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(value),
  );
}

function formatReferenceMonth(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "-";
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function normalizePhoneDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function buildPendingWhatsappUrl(params: {
  phone: string | null | undefined;
  studentName: string | null | undefined;
  referenceMonth: string | null | undefined;
  dueDate: string | null | undefined;
}) {
  const phoneDigits = normalizePhoneDigits(params.phone);
  if (!phoneDigits) return null;

  const monthLabel = formatReferenceMonth(params.referenceMonth);
  const dueDateLabel = formatDateShort(params.dueDate || "");
  const message = `*AVISO IMPORTANTE – NOVA FORMA DE EMITIR BOLETOS*

Olá, ${params.studentName || "tudo bem"}, espero que esteja bem.

Para *facilitar e agilizar o atendimento*, informamos que os *boletos não serão mais enviados individualmente*.

A partir de agora, *todo começo de mês os boletos serão emitidos e disponibilizados em nosso site*, onde poderão ser acessados e baixados para pagamento de forma rápida e prática.

*O seu boleto de ${monthLabel} com vencimento na data 23/03/2026 já está disponível!* Basta seguir as instruções abaixo::

*Como acessar:*

1 - Acesse: https://tavarestransportes.com/2-via-boletos
2 - Informe seu *CPF*
3 - Clique em *“Buscar boletos”*
4 - Pronto! Você poderá *baixar o boleto na hora*

Esse novo formato é *mais rápido, prático e disponível a qualquer momento*, sem precisar aguardar envio.

Se tiver qualquer dificuldade para acessar ou se o seu boleto não estiver disponível, *por favor me chame aqui no WhatsApp que te ajudo.*`;

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
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

type CoverageRow = {
  cpf_digits: string;
  student_name: string | null;
  phone: string | null;
  due_date: string | null;
  searched: boolean;
  downloaded: boolean;
  last_access_at: string | null;
};

const PAGE_SIZE = 50;

export default function BoletoAccessLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [coverageMonth, setCoverageMonth] = useState<string>("LATEST");
  const [page, setPage] = useState(1);
  const [lastWhatsappCpf, setLastWhatsappCpf] = useState<string | null>(null);

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
        (supabase as any)
          .from("public_boleto_access_logs")
          .select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("public_boleto_access_logs")
          .select("id", { count: "exact", head: true })
          .eq("action", "SEARCH"),
        (supabase as any)
          .from("public_boleto_access_logs")
          .select("id", { count: "exact", head: true })
          .eq("action", "DOWNLOAD"),
        (supabase as any)
          .from("public_boleto_access_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date().toISOString().slice(0, 10)),
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

  const { data: coverageMonths = [] } = useQuery({
    queryKey: ["public-boleto-access-coverage-months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payer_boleto_links")
        .select("reference_month")
        .order("reference_month", { ascending: false });

      if (error) throw error;

      return Array.from(
        new Set((data || []).map((row) => row.reference_month).filter(Boolean)),
      ) as string[];
    },
    staleTime: 30_000,
  });

  const { data: coverage, isLoading: coverageLoading } = useQuery({
    queryKey: ["public-boleto-access-coverage", coverageMonth],
    queryFn: async () => {
      let referenceMonth = coverageMonth === "LATEST" ? null : coverageMonth;

      if (!referenceMonth) {
        const { data: latestMonthRow, error: latestMonthError } = await supabase
          .from("payer_boleto_links")
          .select("reference_month")
          .order("reference_month", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMonthError) throw latestMonthError;
        referenceMonth = latestMonthRow?.reference_month || null;
      }
      if (!referenceMonth) {
        return {
          referenceMonth: null,
          rows: [] as CoverageRow[],
          totalStudents: 0,
          searchedStudents: 0,
          downloadedStudents: 0,
          pendingStudents: 0,
          untouchedStudents: 0,
          consultedOnlyStudents: 0,
        };
      }

      const { data: boletoRows, error: boletoRowsError } = await supabase
        .from("payer_boleto_links")
        .select("cpf_digits,student_name,due_date")
        .eq("reference_month", referenceMonth);

      if (boletoRowsError) throw boletoRowsError;

      const boletoMap = new Map<
        string,
        { student_name: string | null; due_date: string | null }
      >();
      for (const row of boletoRows || []) {
        const cpfDigits = String(row.cpf_digits || "").trim();
        if (!cpfDigits) continue;
        if (!boletoMap.has(cpfDigits)) {
          boletoMap.set(cpfDigits, {
            student_name: row.student_name || null,
            due_date: row.due_date || null,
          });
        }
      }

      const { data: logRows, error: logRowsError } = await (supabase as any)
        .from("public_boleto_access_logs")
        .select("cpf_digits,action,created_at,student_name")
        .eq("reference_month", referenceMonth)
        .order("created_at", { ascending: false });

      if (logRowsError) throw logRowsError;

      const cpfList = Array.from(boletoMap.keys());
      const payerPhoneMap = new Map<string, string | null>();
      if (cpfList.length > 0) {
        const { data: payers, error: payersError } = await supabase
          .from("payers")
          .select("document_digits,phone")
          .in("document_digits", cpfList);

        if (payersError) throw payersError;

        for (const payer of payers || []) {
          if (payer.document_digits) {
            payerPhoneMap.set(payer.document_digits, payer.phone || null);
          }
        }
      }

      const rows: CoverageRow[] = Array.from(boletoMap.entries()).map(
        ([cpfDigits, boleto]) => {
          const logsForCpf = (logRows || []).filter(
            (row: any) => row.cpf_digits === cpfDigits,
          );
          const searched = logsForCpf.length > 0;
          const downloaded = logsForCpf.some(
            (row: any) => row.action === "DOWNLOAD",
          );
          const lastAccessAt = logsForCpf[0]?.created_at || null;
          const studentName =
            logsForCpf.find((row: any) => row.student_name)?.student_name ||
            boleto.student_name ||
            null;

          return {
            cpf_digits: cpfDigits,
            student_name: studentName,
            phone: payerPhoneMap.get(cpfDigits) || null,
            due_date: boleto.due_date || null,
            searched,
            downloaded,
            last_access_at: lastAccessAt,
          };
        },
      );

      rows.sort((a, b) => {
        const aPending = a.downloaded ? 1 : 0;
        const bPending = b.downloaded ? 1 : 0;
        if (aPending !== bPending) return aPending - bPending;
        return String(a.student_name || "").localeCompare(
          String(b.student_name || ""),
          "pt-BR",
        );
      });

      return {
        referenceMonth,
        rows,
        totalStudents: rows.length,
        searchedStudents: rows.filter((row) => row.searched).length,
        downloadedStudents: rows.filter((row) => row.downloaded).length,
        pendingStudents: rows.filter((row) => !row.downloaded).length,
        untouchedStudents: rows.filter((row) => !row.searched).length,
        consultedOnlyStudents: rows.filter(
          (row) => row.searched && !row.downloaded,
        ).length,
      };
    },
    staleTime: 30_000,
  });

  const rows = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pendingRows = (coverage?.rows || []).filter((row) => !row.downloaded);
  const pendingWhatsappRows = pendingRows
    .map((row) => ({
      ...row,
      whatsappUrl: buildPendingWhatsappUrl({
        phone: row.phone,
        studentName: row.student_name,
        referenceMonth: coverage?.referenceMonth,
        dueDate: row.due_date,
      }),
    }))
    .filter((row) => !!row.whatsappUrl);

  const openWhatsappBatch = async (limit: number) => {
    const urls = pendingWhatsappRows.slice(0, limit);
    if (urls.length === 0) {
      toast.warning("Nenhum WhatsApp dispon?vel nas pend?ncias deste m?s.");
      return;
    }

    toast.info(`Abrindo ${urls.length} conversa(s) no WhatsApp...`);
    urls.forEach((row, index) => {
      window.setTimeout(() => {
        setLastWhatsappCpf(row.cpf_digits);
        window.open(row.whatsappUrl!, "tavares-whatsapp", "noopener,noreferrer");
      }, index * 900);
    });
  };

  // Numbered pagination
  const maxVisible = 5;
  const half = Math.floor(maxVisible / 2);
  let startPage = Math.max(1, page - half);
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total de acessos
                  </p>
                  <p className="text-xl font-bold">
                    {stats?.total?.toLocaleString("pt-BR") ?? "?"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2.5">
                  <Search className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consultas</p>
                  <p className="text-xl font-bold">
                    {stats?.searches?.toLocaleString("pt-BR") ?? "?"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <div className="rounded-lg bg-green-500/10 p-2.5">
                  <Download className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Downloads</p>
                  <p className="text-xl font-bold">
                    {stats?.downloads?.toLocaleString("pt-BR") ?? "?"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2.5">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                  <p className="text-xl font-bold">
                    {stats?.today?.toLocaleString("pt-BR") ?? "?"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cobertura da 2? via */}
          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr] items-start">
            <Card>
              <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex flex-col items-start gap-1 text-sm sm:text-base">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cobertura do m?s
                  </span>
                  <span className="text-base sm:text-lg font-semibold leading-tight break-words">
                    {formatReferenceMonth(coverage?.referenceMonth)}
                  </span>
                </CardTitle>
                <div className="w-full sm:w-56">
                  <Select
                    value={coverageMonth}
                    onValueChange={setCoverageMonth}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Selecionar m?s" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LATEST">Mais recente</SelectItem>
                      {coverageMonths.map((month) => (
                        <SelectItem key={month} value={month}>
                          {formatReferenceMonth(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Alunos com boleto
                    </p>
                    <p className="text-2xl font-bold">
                      {coverage?.totalStudents ?? "?"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-blue-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      J? consultaram
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {coverage?.searchedStudents ?? "?"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-green-500/5 p-3">
                    <p className="text-xs text-muted-foreground">J? baixaram</p>
                    <p className="text-2xl font-bold text-green-600">
                      {coverage?.downloadedStudents ?? "?"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-amber-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Consultou e n?o baixou
                    </p>
                    <p className="text-2xl font-bold text-amber-600">
                      {coverage?.consultedOnlyStudents ?? "?"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-rose-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Ainda n?o baixaram
                    </p>
                    <p className="text-2xl font-bold text-rose-600">
                      {coverage?.pendingStudents ?? "?"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Nem consultaram
                    </p>
                    <p className="text-2xl font-bold">
                      {coverage?.untouchedStudents ?? "?"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base: alunos com boleto cadastrado no m?s selecionado da 2?
                  via.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Pend?ncias de download
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openWhatsappBatch(5)}
                    disabled={pendingWhatsappRows.length === 0}
                  >
                    Abrir 5 WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openWhatsappBatch(10)}
                    disabled={pendingWhatsappRows.length === 0}
                  >
                    Abrir 10 WhatsApp
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {coverageLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando cobertura...
                  </p>
                ) : pendingRows.length === 0 ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    Todos os alunos j? baixaram seus boletos no m?s analisado.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[320px] overflow-auto pr-1">
                    {pendingRows.map((row) => {
                      const whatsappUrl = buildPendingWhatsappUrl({
                        phone: row.phone,
                        studentName: row.student_name,
                        referenceMonth: coverage?.referenceMonth,
                        dueDate: row.due_date,
                      });

                      return (
                        <div
                          key={row.cpf_digits}
                          className={cn(
                            "rounded-lg border px-3 py-2 overflow-hidden transition-colors",
                            lastWhatsappCpf === row.cpf_digits && "border-emerald-300 bg-emerald-50/70"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {row.student_name || row.cpf_digits}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="font-mono">
                                  {row.cpf_digits}
                                </span>
                                {row.last_access_at && (
                                  <span>
                                    ?ltimo acesso:{" "}
                                    {formatDateTime(row.last_access_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {row.searched ? (
                                <Badge
                                  variant="outline"
                                  className="h-6 whitespace-nowrap text-[11px] text-amber-700 border-amber-300 bg-amber-50"
                                >
                                  Consultou
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="h-6 whitespace-nowrap text-[11px] text-rose-700 border-rose-300 bg-rose-50"
                                >
                                  N?o acessou
                                </Badge>
                              )}
                              {whatsappUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLastWhatsappCpf(row.cpf_digits);
                                    window.open(whatsappUrl, "tavares-whatsapp", "noopener,noreferrer");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  WhatsApp
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Sem WhatsApp
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="CPF, competência ou aluno"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-44">
                  <Label className="text-xs mb-1.5 block">Ação</Label>
                  <Select
                    value={actionFilter}
                    onValueChange={(v) => {
                      setActionFilter(v);
                      setPage(1);
                    }}
                  >
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
              <div className="md:hidden px-4 space-y-3 pb-4">
                {isLoading && (
                  <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                )}
                {!isLoading && rows.length === 0 && (
                  <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
                    Nenhum log encontrado.
                  </div>
                )}
                {!isLoading &&
                  rows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-xl border p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {row.student_name || "Sem identifica?o"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {row.cpf_digits}
                          </p>
                        </div>
                        {row.action === "DOWNLOAD" ? (
                          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 gap-1 text-[11px]">
                            <Download className="h-3 w-3" />
                            Download
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[11px]"
                          >
                            <Search className="h-3 w-3" />
                            Consulta
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Data
                          </p>
                          <p>{formatDateTime(row.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Compet?ncia
                          </p>
                          <p>
                            {row.reference_month
                              ? formatReferenceMonth(row.reference_month)
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Resultados
                          </p>
                          <p>
                            {row.found_count != null
                              ? row.found_count.toLocaleString("pt-BR")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Origem
                          </p>
                          <p>
                            {row._from_payers ? "Cadastro" : row.source || "-"}
                          </p>
                        </div>
                      </div>

                      {row.drive_url && (
                        <a
                          href={row.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Eye className="h-4 w-4" />
                          Ver link
                        </a>
                      )}
                    </div>
                  ))}
              </div>

              <div className="hidden md:block">
                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Data/hora</TableHead>
                        <TableHead>A?o</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Compet?ncia</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Resultados</TableHead>
                        <TableHead className="pr-6">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-10 text-sm text-muted-foreground"
                          >
                            Carregando...
                          </TableCell>
                        </TableRow>
                      )}
                      {!isLoading && rows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-10 text-sm text-muted-foreground"
                          >
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
                              <Badge
                                variant="outline"
                                className="gap-1 text-[11px]"
                              >
                                <Search className="h-3 w-3" />
                                Consulta
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs tracking-wide">
                            {row.cpf_digits}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.reference_month || "-"}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {row.student_name ? (
                              <span className="flex items-center gap-1.5">
                                {row.student_name}
                                {row._from_payers && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 font-normal text-muted-foreground"
                                  >
                                    cadastro
                                  </Badge>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.found_count != null ? (
                              <Badge
                                variant={
                                  row.found_count === 0
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[11px]"
                              >
                                {row.found_count}
                              </Badge>
                            ) : (
                              "-"
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
                              <span className="text-muted-foreground text-xs">
                                -
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pt-4 border-t mt-2 px-4 md:px-6">
                  <p className="text-xs text-muted-foreground">
                    {from + 1}?{Math.min(from + PAGE_SIZE, total)} de{" "}
                    {total.toLocaleString("pt-BR")} ? P?gina {page} de{" "}
                    {totalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 justify-start md:justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {startPage > 1 && (
                      <span className="text-xs text-muted-foreground px-1">
                        ?
                      </span>
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
                      <span className="text-xs text-muted-foreground px-1">
                        ?
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
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
