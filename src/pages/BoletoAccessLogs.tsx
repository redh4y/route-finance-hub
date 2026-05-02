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
  Info,
  Link,
  Clock,
  Siren,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function parseDateLocal(value: string): Date {
  // "YYYY-MM-DD" strings are UTC midnight in JS — shift to local noon to avoid day rollback
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(value);
}

function formatDateShort(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    parseDateLocal(value),
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
3 - Clique em *"Buscar boletos"*
4 - Pronto! Você poderá *baixar o boleto na hora*

Esse novo formato é *mais rápido, prático e disponível a qualquer momento*, sem precisar aguardar envio.

Se tiver qualquer dificuldade para acessar ou se o seu boleto não estiver disponível, *por favor me chame aqui no WhatsApp que te ajudo.*

_Caso já tenha efetuado o pagamento, desconsidere esta mensagem._
_Esta é uma mensagem automática._`;

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

function buildSendLinkWhatsappUrl(params: {
  phone: string | null | undefined;
  studentName: string | null | undefined;
  referenceMonth: string | null | undefined;
  dueDate: string | null | undefined;
  boletoUrl: string | null | undefined;
}) {
  const phoneDigits = normalizePhoneDigits(params.phone);
  if (!phoneDigits || !params.boletoUrl) return null;

  const monthLabel = formatReferenceMonth(params.referenceMonth);
  const dueDateLabel = formatDateShort(params.dueDate || "");
  const message = `Ol\u00e1, *${params.studentName || ""}*! Aqui \u00e9 da *Tavares Transportes*.\n\nPassando para avisar que o seu boleto referente ao m\u00eas de *${monthLabel}* j\u00e1 est\u00e1 dispon\u00edvel.\n\n*Vencimento:* ${dueDateLabel}\n*Acesse seu boleto aqui:* ${params.boletoUrl}\n\nSe precisar de qualquer ajuda ou tiver alguma d\u00favida, nossa equipe est\u00e1 \u00e0 disposi\u00e7\u00e3o.\n\nAtenciosamente,\n*Equipe Tavares Transportes*\n\n_Caso j\u00e1 tenha efetuado o pagamento, desconsidere esta mensagem._\n_Esta \u00e9 uma mensagem autom\u00e1tica._`;

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

function buildDueDateReminderUrl(params: {
  phone: string | null | undefined;
  studentName: string | null | undefined;
  referenceMonth: string | null | undefined;
  dueDate: string | null | undefined;
  boletoUrl: string | null | undefined;
}) {
  const phoneDigits = normalizePhoneDigits(params.phone);
  if (!phoneDigits || !params.dueDate) return null;

  const due = parseDateLocal(params.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const monthLabel = formatReferenceMonth(params.referenceMonth);
  const dueDateLabel = formatDateShort(params.dueDate);

  let prazo: string;
  if (diffDays < 0) prazo = `venceu h\u00e1 *${Math.abs(diffDays)}* dia(s)`;
  else if (diffDays === 0) prazo = "*hoje*";
  else if (diffDays === 1) prazo = "*1* dia";
  else prazo = `*${diffDays}* dias`;

  const boletoLine = params.boletoUrl
    ? `*Acesse ou baixe aqui:* ${params.boletoUrl}`
    : `*Acesse ou baixe aqui:* https://tavarestransportes.com/2-via-boletos`;

  const rodape = `\n\n_Caso j\u00e1 tenha efetuado o pagamento, desconsidere esta mensagem._\n_Esta \u00e9 uma mensagem autom\u00e1tica._`;

  const message =
    diffDays < 0
      ? `Ol\u00e1, *${params.studentName || ""}*! Tudo bem?\n\nO seu boleto da *Tavares Transportes* (referente a *${monthLabel}*) ${prazo} e ainda n\u00e3o foi baixado.\n\n*Vencimento:* ${dueDateLabel}\n${boletoLine}\n\nQualquer d\u00favida ou dificuldade com o link, nossa equipe est\u00e1 \u00e0 disposi\u00e7\u00e3o.${rodape}`
      : `Ol\u00e1, *${params.studentName || ""}*! Tudo bem?\n\nFaltam ${prazo} para o vencimento do seu boleto da *Tavares Transportes* (referente a *${monthLabel}*). Como ele ainda n\u00e3o foi baixado, viemos facilitar o acesso para voc\u00ea!\n\n*Vencimento:* ${dueDateLabel}\n${boletoLine}\n\nQualquer d\u00favida ou dificuldade com o link, nossa equipe est\u00e1 \u00e0 disposi\u00e7\u00e3o.${rodape}`;

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

function buildUrgencyWhatsappUrl(params: {
  phone: string | null | undefined;
  studentName: string | null | undefined;
  referenceMonth: string | null | undefined;
  boletoUrl: string | null | undefined;
}) {
  const phoneDigits = normalizePhoneDigits(params.phone);
  if (!phoneDigits || !params.boletoUrl) return null;

  const monthLabel = formatReferenceMonth(params.referenceMonth);
  const message = `Olá, *${params.studentName || ""}*!

Identificamos que o boleto da *Tavares Transportes* (*${monthLabel}*) ainda consta em aberto no nosso sistema.

*ALERTA IMPORTANTE:* O não pagamento desta pendência *impossibilita que você continue utilizando o transporte e bloqueia o seu embarque*, conforme previsto na *Cláusula 5, § 3°* do seu contrato.

*Aguardamos seu retorno:* Por favor, responda a esta mensagem confirmando o recebimento dela e informando a previsão de pagamento para regularizarmos sua situação e evitar o bloqueio.

*Acesse seu boleto aqui:* ${params.boletoUrl}

Qualquer dúvida, entre em contato conosco.

_Caso o pagamento já tenha sido efetuado, favor enviar o comprovante._

_Esta é uma mensagem automática. Caso já tenha combinado algo com a administração, favor ignorar._`;

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
  boleto_url: string | null;
  searched: boolean;
  downloaded: boolean;
  is_paid: boolean;
  is_cancelled: boolean;
  is_active: boolean;
  last_access_at: string | null;
};

const PAGE_SIZE = 50;

export default function BoletoAccessLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [coverageMonth, setCoverageMonth] = useState<string>("LATEST");
  const [page, setPage] = useState(1);
  const [lastWhatsappCpf, setLastWhatsappCpf] = useState<string | null>(null);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingStatusFilter, setPendingStatusFilter] = useState<
    "all" | "unpaid" | "searched" | "untouched"
  >("unpaid");

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
        .select("cpf_digits,student_name,due_date,view_url,drive_url,payer_id")
        .eq("reference_month", referenceMonth);

      if (boletoRowsError) throw boletoRowsError;

      const boletoMap = new Map<
        string,
        {
          student_name: string | null;
          due_date: string | null;
          boleto_url: string | null;
          payer_id: string | null;
        }
      >();
      for (const row of boletoRows || []) {
        const cpfDigits = String(row.cpf_digits || "").trim();
        if (!cpfDigits) continue;
        if (!boletoMap.has(cpfDigits)) {
          boletoMap.set(cpfDigits, {
            student_name: row.student_name || null,
            due_date: row.due_date || null,
            boleto_url: row.drive_url || row.view_url || null,
            payer_id:
              ((row as Record<string, unknown>).payer_id as string | null) ||
              null,
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

      // Fetch only ATIVO payers (phones) — INATIVO payers won't receive messages
      const payerPhoneMap = new Map<string, string | null>();
      const activePayerCpfs = new Set<string>();
      if (cpfList.length > 0) {
        const { data: payers, error: payersError } = await supabase
          .from("payers")
          .select("id,document_digits,phone")
          .in("document_digits", cpfList)
          .eq("status", "ATIVO");

        if (payersError) throw payersError;

        for (const payer of payers || []) {
          if (payer.document_digits) {
            payerPhoneMap.set(payer.document_digits, payer.phone || null);
            activePayerCpfs.add(payer.document_digits);
          }
        }
      }

      // Fetch paid/cancelled billings for this month to exclude from pending messages
      const allPayerIds = Array.from(boletoMap.values())
        .map((b) => b.payer_id)
        .filter((id): id is string => !!id);
      const paidPayerIds = new Set<string>();
      const cancelledPayerIds = new Set<string>();
      if (allPayerIds.length > 0) {
        const { data: resolvedBillings } = await supabase
          .from("billings")
          .select("payer_id,status")
          .in("payer_id", allPayerIds)
          .eq("reference_month", referenceMonth)
          .in("status", ["PAID", "CANCELADO"]);
        for (const b of (resolvedBillings || []) as { payer_id: string | null; status: string }[]) {
          if (!b.payer_id) continue;
          if (b.status === "PAID") paidPayerIds.add(b.payer_id);
          if (b.status === "CANCELADO") cancelledPayerIds.add(b.payer_id);
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
          const isPaid = !!(boleto.payer_id && paidPayerIds.has(boleto.payer_id));
          const isCancelled = !!(boleto.payer_id && cancelledPayerIds.has(boleto.payer_id));
          const isActive = activePayerCpfs.has(cpfDigits);

          return {
            cpf_digits: cpfDigits,
            student_name: studentName,
            phone: payerPhoneMap.get(cpfDigits) || null,
            due_date: boleto.due_date || null,
            boleto_url: boleto.boleto_url || null,
            searched,
            downloaded,
            is_paid: isPaid,
            is_cancelled: isCancelled,
            is_active: isActive,
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

  const resolvedCoverageMonth = coverage?.referenceMonth ?? null;

  const { data: contactCounts, refetch: refetchContacts } = useQuery({
    queryKey: ["boleto-contact-log-counts", resolvedCoverageMonth],
    queryFn: async () => {
      if (!resolvedCoverageMonth) return new Map<string, number>();
      const { data, error } = await supabase
        .from("boleto_contact_log")
        .select("cpf_digits")
        .eq("reference_month", resolvedCoverageMonth);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data || []) {
        counts.set(row.cpf_digits, (counts.get(row.cpf_digits) ?? 0) + 1);
      }
      return counts;
    },
    enabled: !!resolvedCoverageMonth,
    staleTime: 10_000,
  });

  const logContact = async (cpf_digits: string, message_type: string) => {
    if (!resolvedCoverageMonth) return;
    await supabase.from("boleto_contact_log").insert({
      reference_month: resolvedCoverageMonth,
      cpf_digits,
      message_type,
    });
    refetchContacts();
  };

  const rows = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeRows = (coverage?.rows || []).filter((row) => row.is_active);
  // Apenas alunos ativos com boleto não pago e não cancelado (base para WhatsApp e ações em lote)
  const unpaidRows = activeRows.filter((row) => !row.is_paid && !row.is_cancelled);

  const filteredPendingRows = (
    pendingStatusFilter === "all" ? activeRows : unpaidRows
  ).filter((row) => {
    if (pendingStatusFilter === "searched" && !row.searched) return false;
    if (pendingStatusFilter === "untouched" && row.searched) return false;
    if (pendingSearch.trim()) {
      const q = pendingSearch.trim().toLowerCase();
      const name = (row.student_name || "").toLowerCase();
      const cpf = row.cpf_digits.toLowerCase();
      if (!name.includes(q) && !cpf.includes(q)) return false;
    }
    return true;
  });

  const semNumeroCount = unpaidRows.filter(
    (r) => !normalizePhoneDigits(r.phone),
  ).length;

  const exportPendingCsv = () => {
    if (filteredPendingRows.length === 0) {
      toast.warning("Nenhuma pendência para exportar.");
      return;
    }
    const header = [
      "Nome",
      "CPF",
      "Telefone",
      "Status",
      "Último acesso",
      "Vencimento",
    ].join(";");
    const lines = filteredPendingRows.map((r) =>
      [
        r.student_name || "",
        r.cpf_digits,
        r.phone || "",
        r.searched ? "Consultou" : "Não acessou",
        r.last_access_at ? formatDateTime(r.last_access_at) : "Nunca acessou",
        r.due_date ? formatDateShort(r.due_date) : "",
      ].join(";"),
    );
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendencias-${coverage?.referenceMonth || "mes"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredPendingRows.length} pendências exportadas.`);
  };
  const pendingWhatsappRows = unpaidRows
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

  const pendingSendLinkRows = unpaidRows
    .map((row) => ({
      ...row,
      whatsappUrl: buildSendLinkWhatsappUrl({
        phone: row.phone,
        studentName: row.student_name,
        referenceMonth: coverage?.referenceMonth,
        dueDate: row.due_date,
        boletoUrl: row.boleto_url,
      }),
    }))
    .filter((row) => !!row.whatsappUrl);

  const pendingVencimentoRows = unpaidRows
    .map((row) => ({
      ...row,
      whatsappUrl: buildDueDateReminderUrl({
        phone: row.phone,
        studentName: row.student_name,
        referenceMonth: coverage?.referenceMonth,
        dueDate: row.due_date,
        boletoUrl: row.boleto_url,
      }),
    }))
    .filter((row) => !!row.whatsappUrl);

  const firstDueDate = unpaidRows.find((r) => r.due_date)?.due_date ?? null;
  const daysUntilDue = (() => {
    if (!firstDueDate) return null;
    const due = parseDateLocal(firstDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const openBatch = (
    urls: { cpf_digits: string; whatsappUrl: string | null }[],
    windowName: string,
  ) => {
    if (urls.length === 0) {
      toast.warning("Nenhum WhatsApp disponível nas pendências deste mês.");
      return;
    }
    toast.info(`Abrindo ${urls.length} conversa(s) no WhatsApp...`);
    const messageType =
      windowName === "tavares-whatsapp-emissao" ? "emissao"
      : windowName === "tavares-whatsapp-link" ? "link"
      : windowName === "tavares-whatsapp-venc" ? "vencimento"
      : "urgente";
    urls.forEach((row, index) => {
      window.setTimeout(() => {
        setLastWhatsappCpf(row.cpf_digits);
        window.open(row.whatsappUrl!, windowName, "noopener,noreferrer");
        logContact(row.cpf_digits, messageType);
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
    <TooltipProvider delayDuration={300}>
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
                      {stats?.total?.toLocaleString("pt-BR") ?? "–"}
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
                      {stats?.searches?.toLocaleString("pt-BR") ?? "–"}
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
                      {stats?.downloads?.toLocaleString("pt-BR") ?? "–"}
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
                      {stats?.today?.toLocaleString("pt-BR") ?? "–"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cobertura da 2ª via */}
            <Card>
              <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex flex-col items-start gap-1 text-sm sm:text-base">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cobertura do mês
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
                      <SelectValue placeholder="Selecionar mês" />
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
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Alunos com boleto
                    </p>
                    <p className="text-2xl font-bold">
                      {coverage?.totalStudents ?? "–"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-blue-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Já consultaram
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {coverage?.searchedStudents ?? "–"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-green-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Já baixaram</p>
                    <p className="text-2xl font-bold text-green-600">
                      {coverage?.downloadedStudents ?? "–"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-amber-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Consultou e não baixou
                    </p>
                    <p className="text-2xl font-bold text-amber-600">
                      {coverage?.consultedOnlyStudents ?? "–"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-rose-500/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Ainda não baixaram
                    </p>
                    <p className="text-2xl font-bold text-rose-600">
                      {coverage?.pendingStudents ?? "–"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Nem consultaram
                    </p>
                    <p className="text-2xl font-bold">
                      {coverage?.untouchedStudents ?? "–"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base: alunos com boleto cadastrado no mês selecionado da 2ª
                  via. Apenas quem ainda não baixou o boleto aparece nas
                  pendências abaixo.
                </p>
              </CardContent>
            </Card>

            {/* Pendências de download */}
            <Card>
              <CardHeader className="pb-3 flex flex-col gap-4">
                {/* Linha 1: título + badges + botões batch */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Pendências de download
                    </CardTitle>
                    {unpaidRows.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-rose-600 border-rose-300 bg-rose-50 font-mono"
                      >
                        {unpaidRows.length} não pagos
                      </Badge>
                    )}
                    {pendingStatusFilter === "all" && activeRows.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-slate-600 border-slate-300 bg-slate-50 font-mono"
                      >
                        {activeRows.length} total
                      </Badge>
                    )}
                    {filteredPendingRows.length !==
                      (pendingStatusFilter === "all"
                        ? activeRows.length
                        : unpaidRows.length) && (
                      <Badge
                        variant="outline"
                        className="text-blue-600 border-blue-300 bg-blue-50 font-mono"
                      >
                        {filteredPendingRows.length} filtrados
                      </Badge>
                    )}
                    {semNumeroCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground border-muted-foreground/30 font-mono"
                      >
                        {semNumeroCount} sem número
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openBatch(
                          pendingWhatsappRows,
                          "tavares-whatsapp-emissao",
                        )
                      }
                      disabled={pendingWhatsappRows.length === 0}
                    >
                      Aviso de emissão (todos)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openBatch(pendingSendLinkRows, "tavares-whatsapp-link")
                      }
                      disabled={pendingSendLinkRows.length === 0}
                    >
                      Enviar link do boleto (todos)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openBatch(
                          pendingVencimentoRows,
                          "tavares-whatsapp-venc",
                        )
                      }
                      disabled={pendingVencimentoRows.length === 0}
                    >
                      {daysUntilDue !== null
                        ? daysUntilDue < 0
                          ? `Aviso vencimento (atrasado ${Math.abs(daysUntilDue)}d)`
                          : daysUntilDue === 0
                            ? "Aviso vencimento (hoje!)"
                            : `Aviso vencimento (faltam ${daysUntilDue}d)`
                        : "Aviso de vencimento"}
                    </Button>
                  </div>
                </div>
                {/* Linha 2: busca + filtro de status + exportar */}
                {unpaidRows.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Buscar por nome ou CPF..."
                        value={pendingSearch}
                        onChange={(e) => setPendingSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                    <Select
                      value={pendingStatusFilter}
                      onValueChange={(v) =>
                        setPendingStatusFilter(
                          v as "all" | "unpaid" | "searched" | "untouched",
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="unpaid">Não pago</SelectItem>
                        <SelectItem value="searched">Consultou</SelectItem>
                        <SelectItem value="untouched">Não acessou</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={exportPendingCsv}
                      className="h-9 shrink-0"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Exportar CSV
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {coverageLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando cobertura...
                  </p>
                ) : unpaidRows.length === 0 ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Todos os alunos já baixaram seus boletos no mês analisado.
                  </div>
                ) : filteredPendingRows.length === 0 ? (
                  <div className="rounded-xl border border-muted bg-muted/20 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Search className="h-4 w-4 shrink-0" />
                    Nenhuma pendência encontrada com os filtros aplicados.
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[600px] rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                        <tr className="border-b">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[30%]">
                            Aluno
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[15%]">
                            CPF
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[12%]">
                            Status
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">
                            Vencimento
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[13%]">
                            Último acesso
                          </th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[20%]">
                            Contato
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredPendingRows.map((row) => {
                          const whatsappUrl = buildPendingWhatsappUrl({
                            phone: row.phone,
                            studentName: row.student_name,
                            referenceMonth: coverage?.referenceMonth,
                            dueDate: row.due_date,
                          });
                          const sendLinkUrl = buildSendLinkWhatsappUrl({
                            phone: row.phone,
                            studentName: row.student_name,
                            referenceMonth: coverage?.referenceMonth,
                            dueDate: row.due_date,
                            boletoUrl: row.boleto_url,
                          });
                          const vencimentoUrl = buildDueDateReminderUrl({
                            phone: row.phone,
                            studentName: row.student_name,
                            referenceMonth: coverage?.referenceMonth,
                            dueDate: row.due_date,
                            boletoUrl: row.boleto_url,
                          });
                          const urgencyUrl = buildUrgencyWhatsappUrl({
                            phone: row.phone,
                            studentName: row.student_name,
                            referenceMonth: coverage?.referenceMonth,
                            boletoUrl: row.boleto_url,
                          });
                          const isHighlighted =
                            lastWhatsappCpf === row.cpf_digits;

                          return (
                            <tr
                              key={row.cpf_digits}
                              className={cn(
                                "",
                                isHighlighted &&
                                  "bg-emerald-200 border-l-4 border-l-emerald-500",
                              )}
                            >
                              <td className="px-3 py-2.5 font-medium truncate max-w-0">
                                <span className="block truncate">
                                  {row.student_name || (
                                    <span className="text-muted-foreground italic">
                                      Sem nome
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {row.cpf_digits}
                              </td>
                              <td className="px-3 py-2.5">
                                {row.is_paid ? (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap text-[11px] text-green-700 border-green-300 bg-green-50"
                                  >
                                    Pago
                                  </Badge>
                                ) : row.is_cancelled ? (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap text-[11px] text-slate-600 border-slate-300 bg-slate-50"
                                  >
                                    Baixado
                                  </Badge>
                                ) : row.searched ? (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap text-[11px] text-amber-700 border-amber-300 bg-amber-50"
                                  >
                                    Consultou
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap text-[11px] text-rose-700 border-rose-300 bg-rose-50"
                                  >
                                    Não acessou
                                  </Badge>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                {row.due_date ? (
                                  new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR")
                                ) : (
                                  <span className="italic">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                {row.last_access_at ? (
                                  formatDateTime(row.last_access_at)
                                ) : (
                                  <span className="italic">Nunca acessou</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {row.is_paid || row.is_cancelled ? null : (
                                  <div className="flex flex-col items-end gap-1">
                                    {(contactCounts?.get(row.cpf_digits) ?? 0) > 0 && (
                                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                                        {contactCounts!.get(row.cpf_digits)}× contatado
                                      </span>
                                    )}
                                  <div className="flex items-center justify-end gap-1">
                                    {whatsappUrl ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLastWhatsappCpf(row.cpf_digits);
                                              window.open(whatsappUrl, "tavares-whatsapp", "noopener,noreferrer");
                                              logContact(row.cpf_digits, "emissao");
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                          >
                                            <Info className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Aviso de emissão</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">
                                        Sem número
                                      </span>
                                    )}
                                    {sendLinkUrl && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLastWhatsappCpf(row.cpf_digits);
                                              window.open(sendLinkUrl, "tavares-whatsapp-link", "noopener,noreferrer");
                                              logContact(row.cpf_digits, "link");
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100 transition-colors"
                                          >
                                            <Link className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Enviar link do boleto</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {vencimentoUrl && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLastWhatsappCpf(row.cpf_digits);
                                              window.open(vencimentoUrl, "tavares-whatsapp-venc", "noopener,noreferrer");
                                              logContact(row.cpf_digits, "vencimento");
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 p-1.5 text-amber-700 hover:bg-amber-100 transition-colors"
                                          >
                                            <Clock className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Avisar vencimento</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {urgencyUrl && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setLastWhatsappCpf(row.cpf_digits);
                                              window.open(urgencyUrl, "tavares-whatsapp-urgency", "noopener,noreferrer");
                                              logContact(row.cpf_digits, "urgente");
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 transition-colors"
                                          >
                                            <Siren className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Aviso urgente de pendência</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

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
                              {row.student_name || "Sem identificação"}
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
                              Competência
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
                              {row._from_payers
                                ? "Cadastro"
                                : row.source || "-"}
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
                      {from + 1}–{Math.min(from + PAGE_SIZE, total)} de{" "}
                      {total.toLocaleString("pt-BR")} · Página {page} de{" "}
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
                          …
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
                          …
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
    </TooltipProvider>
  );
}
