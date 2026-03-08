import { useMemo, useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, Link as LinkIcon, CheckCircle2, AlertTriangle, FileText, Users, Search, Eye, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DriveProcessorTab } from "@/components/boletos/DriveProcessorTab";

type PayerLite = {
  id: string;
  name: string;
  document_digits: string | null;
  phone: string | null;
};

type MonthActivePayer = {
  id: string;
  name: string;
  document_digits: string | null;
};

type ParsedLine = {
  id: string;
  raw: string;
  student_name: string | null;
  drive_url: string | null;
  payer_id: string | null;
  cpf_digits: string | null;
  phone_digits: string | null;
  reference_month: string | null;
  due_date: string | null;
  amount_cents: number | null;
  digitable_line: string | null;
  our_number: string | null;
  file_id: string | null;
  view_url: string | null;
  read_source: string | null;
  match_status: "MATCH" | "NO_MATCH" | "MISSING_URL" | "MISSING_DATA" | "MULTIPLE";
};

type BoletoJsonRow = {
  read_source?: string | null;
  payer_name?: string | null;
  payer_cpf?: string | null;
  our_number?: string | null;
  digitable_line?: string | null;
  amount?: string | null;
  due_date?: string | null;
  file_id?: string | null;
  download_link?: string | null;
  view_link?: string | null;
  success?: boolean | null;
  error?: string | null;
};

function normalizeName(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDigits(input: string | null | undefined) {
  return String(input || "").replace(/\D/g, "");
}

function extractName(raw: string) {
  const byGreeting = raw.match(/^(?:olá|ola)\s+(.+?)[!\n\r]/i);
  if (byGreeting?.[1]) return byGreeting[1].trim();

  const byQuoted = raw.match(/^"?([^"\n\r]+)"?\s*$/);
  if (byQuoted?.[1] && !/^https?:\/\//i.test(byQuoted[1])) return byQuoted[1].trim();

  return null;
}

function extractDriveUrl(raw: string) {
  const match = raw.match(/https?:\/\/drive\.google\.com\/[^\s"']+/i);
  return match?.[0] || null;
}

function parseBrDateToIso(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function deriveReferenceMonthFromDueDate(dueDateIso: string | null) {
  if (!dueDateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dueDateIso)) return null;
  const [y, m, d] = dueDateIso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if ((d || 0) <= 10) {
    date.setMonth(date.getMonth() - 1);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseAmountToCents(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100);
}

function parseBoletoJsonRows(text: string): BoletoJsonRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const tryParse = (input: string) => {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(trimmed);
  if (!parsed) {
    parsed = tryParse(`[${trimmed}]`);
  }

  if (Array.isArray(parsed)) return parsed as BoletoJsonRow[];
  if (parsed && Array.isArray((parsed as any).items)) return (parsed as any).items as BoletoJsonRow[];
  if (parsed && Array.isArray((parsed as any).data)) return (parsed as any).data as BoletoJsonRow[];

  return [];
}

function isPartialNameMatch(a: string, b: string) {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

async function readRows(file: File): Promise<string[]> {
  const ext = file.name.toLowerCase().split(".").pop();

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    return rows
      .map((cells) => (Array.isArray(cells) ? cells.filter(Boolean).map((c) => String(c).trim()).join(" ") : ""))
      .filter(Boolean);
  }

  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      complete: (results) => {
        const lines = (results.data || [])
          .map((row) => (Array.isArray(row) ? row.filter(Boolean).map((c) => String(c).trim()).join(" ") : ""))
          .filter(Boolean);
        resolve(lines);
      },
      error: reject,
    });
  });
}

export default function BoletoLinksPage() {
  const [referenceMonth, setReferenceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchPreview, setSearchPreview] = useState("");

  const { data: payers = [] } = useQuery({
    queryKey: ["payers-lite-boleto-links"],
    queryFn: async (): Promise<PayerLite[]> => {
      const { data, error } = await supabase
        .from("payers")
        .select("id,name,document_digits,phone")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as PayerLite[];
    },
  });

  const payerNormalized = useMemo(
    () =>
      payers.map((p) => ({
        payer: p,
        nameNorm: normalizeName(p.name || ""),
      })),
    [payers],
  );

  const payerByDocument = useMemo(() => {
    const map = new Map<string, PayerLite>();
    for (const p of payers) {
      const doc = normalizeDigits(p.document_digits);
      if (doc) map.set(doc, p);
    }
    return map;
  }, [payers]);

  const { data: activeMonthPayers = [] } = useQuery({
    queryKey: ["boleto-links-active-month", referenceMonth],
    queryFn: async (): Promise<MonthActivePayer[]> => {
      const { data, error } = await (supabase as any)
        .from("billings")
        .select("payer_id,payers(id,name,status,document_digits)")
        .eq("reference_month", referenceMonth)
        .in("status", ["OPEN", "PAID"]);

      if (error) throw error;

      const unique = new Map<string, MonthActivePayer>();
      for (const row of data || []) {
        const payerId = row?.payer_id as string | null;
        const payerRel = Array.isArray(row?.payers) ? row.payers[0] : row?.payers;
        const payerStatus = String(payerRel?.status || "");
        if (!payerId || payerStatus !== "ATIVO") continue;
        unique.set(payerId, {
          id: payerId,
          name: String(payerRel?.name || payerId),
          document_digits: normalizeDigits(String(payerRel?.document_digits || "")) || null,
        });
      }

      return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: existingMonthLinks = [] } = useQuery({
    queryKey: ["boleto-links-existing-month", referenceMonth],
    queryFn: async (): Promise<Array<{ payer_id: string | null; cpf_digits: string | null }>> => {
      const { data, error } = await (supabase as any)
        .from("payer_boleto_links")
        .select("payer_id,cpf_digits")
        .eq("reference_month", referenceMonth);
      if (error) throw error;
      return (data || []) as Array<{ payer_id: string | null; cpf_digits: string | null }>;
    },
  });


  const stats = useMemo(() => {
    const total = lines.length;
    const match = lines.filter((l) => l.match_status === "MATCH").length;
    const noMatch = lines.filter((l) => l.match_status === "NO_MATCH").length;
    const multiple = lines.filter((l) => l.match_status === "MULTIPLE").length;
    const missingUrl = lines.filter((l) => l.match_status === "MISSING_URL").length;
    const missingData = lines.filter((l) => l.match_status === "MISSING_DATA").length;
    return { total, match, noMatch, multiple, missingUrl, missingData };
  }, [lines]);


  const monthCoverage = useMemo(() => {
    const linkedIds = new Set<string>();
    const linkedCpfs = new Set<string>();

    for (const row of existingMonthLinks) {
      if (row?.payer_id) linkedIds.add(String(row.payer_id));
      const cpf = normalizeDigits(row?.cpf_digits || "");
      if (cpf) linkedCpfs.add(cpf);
    }

    for (const line of lines) {
      if (line.match_status === "MATCH" && line.payer_id) {
        linkedIds.add(String(line.payer_id));
      }
      const cpf = normalizeDigits(line.cpf_digits || "");
      if (cpf) linkedCpfs.add(cpf);
    }

    const missing = activeMonthPayers.filter((payer) => {
      if (linkedIds.has(payer.id)) return false;
      const cpf = normalizeDigits(payer.document_digits || "");
      if (cpf && linkedCpfs.has(cpf)) return false;
      return true;
    });

    return {
      expected: activeMonthPayers.length,
      linked: activeMonthPayers.length - missing.length,
      missing,
    };
  }, [activeMonthPayers, existingMonthLinks, lines]);

  const filteredLines = useMemo(() => {
    const q = searchPreview.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => {
      const haystack = [
        line.student_name || "",
        line.cpf_digits || "",
        line.phone_digits || "",
        line.drive_url || "",
        line.match_status || "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [lines, searchPreview]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const selected = e.dataTransfer.files?.[0] || null;
    if (selected) {
      void handleFile(selected);
    }
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    setIsParsing(true);
    try {
      let parsed: ParsedLine[] = [];
      const ext = f.name.toLowerCase().split(".").pop();

      if (ext === "json") {
        const text = await f.text();
        const rows = parseBoletoJsonRows(text).filter((r) => r && r.success !== false && !r.error);

        parsed = rows.map((row, idx): ParsedLine => {
          const studentName = String(row.payer_name || "").trim() || null;
          const cpfFromFile = normalizeDigits(row.payer_cpf);
          const driveUrl = String(row.download_link || row.view_link || "").trim() || null;
          const dueDateIso = parseBrDateToIso(row.due_date);
          const derivedRefMonth = deriveReferenceMonthFromDueDate(dueDateIso);

          if (!driveUrl) {
            return {
              id: String(idx),
              raw: JSON.stringify(row),
              student_name: studentName,
              drive_url: null,
              payer_id: null,
              cpf_digits: cpfFromFile || null,
              phone_digits: null,
              reference_month: derivedRefMonth,
              due_date: dueDateIso,
              amount_cents: parseAmountToCents(row.amount),
              digitable_line: row.digitable_line || null,
              our_number: row.our_number || null,
              file_id: row.file_id || null,
              view_url: row.view_link || null,
              read_source: row.read_source || null,
              match_status: "MISSING_URL",
            };
          }

          if (!cpfFromFile) {
            return {
              id: String(idx),
              raw: JSON.stringify(row),
              student_name: studentName,
              drive_url: driveUrl,
              payer_id: null,
              cpf_digits: null,
              phone_digits: null,
              reference_month: derivedRefMonth,
              due_date: dueDateIso,
              amount_cents: parseAmountToCents(row.amount),
              digitable_line: row.digitable_line || null,
              our_number: row.our_number || null,
              file_id: row.file_id || null,
              view_url: row.view_link || null,
              read_source: row.read_source || null,
              match_status: "MISSING_DATA",
            };
          }

          const payerByCpf = payerByDocument.get(cpfFromFile) || null;
          if (!payerByCpf) {
            return {
              id: String(idx),
              raw: JSON.stringify(row),
              student_name: studentName,
              drive_url: driveUrl,
              payer_id: null,
              cpf_digits: cpfFromFile,
              phone_digits: null,
              reference_month: derivedRefMonth,
              due_date: dueDateIso,
              amount_cents: parseAmountToCents(row.amount),
              digitable_line: row.digitable_line || null,
              our_number: row.our_number || null,
              file_id: row.file_id || null,
              view_url: row.view_link || null,
              read_source: row.read_source || null,
              match_status: "NO_MATCH",
            };
          }

          return {
            id: String(idx),
            raw: JSON.stringify(row),
            student_name: studentName || payerByCpf.name,
            drive_url: driveUrl,
            payer_id: payerByCpf.id,
            cpf_digits: cpfFromFile,
            phone_digits: normalizeDigits(payerByCpf.phone) || null,
            reference_month: derivedRefMonth,
            due_date: dueDateIso,
            amount_cents: parseAmountToCents(row.amount),
            digitable_line: row.digitable_line || null,
            our_number: row.our_number || null,
            file_id: row.file_id || null,
            view_url: row.view_link || null,
            read_source: row.read_source || null,
            match_status: "MATCH",
          };
        });
      } else {
        const rows = await readRows(f);

        parsed = rows.map((raw, idx): ParsedLine => {
          const studentName = extractName(raw);
          const driveUrl = extractDriveUrl(raw);

          if (!driveUrl) {
            return {
              id: String(idx),
              raw,
              student_name: studentName,
              drive_url: null,
              payer_id: null,
              cpf_digits: null,
              phone_digits: null,
              reference_month: referenceMonth,
              due_date: null,
              amount_cents: null,
              digitable_line: null,
              our_number: null,
              file_id: null,
              view_url: null,
              read_source: null,
              match_status: "MISSING_URL",
            };
          }

          if (!studentName) {
            return {
              id: String(idx),
              raw,
              student_name: null,
              drive_url: driveUrl,
              payer_id: null,
              cpf_digits: null,
              phone_digits: null,
              reference_month: referenceMonth,
              due_date: null,
              amount_cents: null,
              digitable_line: null,
              our_number: null,
              file_id: null,
              view_url: null,
              read_source: null,
              match_status: "NO_MATCH",
            };
          }

          const key = normalizeName(studentName);
          const exact = payerNormalized.filter((p) => p.nameNorm === key);
          const partial = exact.length === 0 ? payerNormalized.filter((p) => isPartialNameMatch(p.nameNorm, key)) : [];
          const matches = exact.length > 0 ? exact : partial;

          if (matches.length > 1) {
            return {
              id: String(idx),
              raw,
              student_name: studentName,
              drive_url: driveUrl,
              payer_id: null,
              cpf_digits: null,
              phone_digits: null,
              reference_month: referenceMonth,
              due_date: null,
              amount_cents: null,
              digitable_line: null,
              our_number: null,
              file_id: null,
              view_url: null,
              read_source: null,
              match_status: "MULTIPLE",
            };
          }

          if (matches.length === 0) {
            return {
              id: String(idx),
              raw,
              student_name: studentName,
              drive_url: driveUrl,
              payer_id: null,
              cpf_digits: null,
              phone_digits: null,
              reference_month: referenceMonth,
              due_date: null,
              amount_cents: null,
              digitable_line: null,
              our_number: null,
              file_id: null,
              view_url: null,
              read_source: null,
              match_status: "NO_MATCH",
            };
          }

          const payer = matches[0].payer;
          const cpf = normalizeDigits(payer.document_digits);
          const phone = normalizeDigits(payer.phone);

          if (!cpf) {
            return {
              id: String(idx),
              raw,
              student_name: studentName,
              drive_url: driveUrl,
              payer_id: payer.id,
              cpf_digits: null,
              phone_digits: phone || null,
              reference_month: referenceMonth,
              due_date: null,
              amount_cents: null,
              digitable_line: null,
              our_number: null,
              file_id: null,
              view_url: null,
              read_source: null,
              match_status: "MISSING_DATA",
            };
          }

          return {
            id: String(idx),
            raw,
            student_name: studentName,
            drive_url: driveUrl,
            payer_id: payer.id,
            cpf_digits: cpf,
            phone_digits: phone || null,
            reference_month: referenceMonth,
            due_date: null,
            amount_cents: null,
            digitable_line: null,
            our_number: null,
            file_id: null,
            view_url: null,
            read_source: null,
            match_status: "MATCH",
          };
        });
      }

      const firstRef = parsed.find((x) => x.reference_month)?.reference_month;
      if (firstRef && /^\d{4}-\d{2}$/.test(firstRef)) {
        setReferenceMonth(firstRef);
      }

      setLines(parsed);
      toast.success(`Arquivo lido: ${parsed.length} linhas.`);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao ler arquivo");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const valid = lines.filter((l) => l.match_status === "MATCH" && l.drive_url && l.cpf_digits);
    if (valid.length === 0) {
      toast.error("Nenhuma linha valida para importar.");
      return;
    }

    setIsSaving(true);
    try {
      const uniqueByKey = new Map<string, ParsedLine>();
      for (const row of valid) {
        const key = row.our_number ? `OUR:${String(row.our_number)}` : `${String(row.cpf_digits)}|${String(row.drive_url)}`;
        uniqueByKey.set(key, row);
      }

      const dedupedValid = Array.from(uniqueByKey.values());
      const repeatedInFile = valid.length - dedupedValid.length;

      const payload = dedupedValid.map((l) => ({
        reference_month: l.reference_month || referenceMonth,
        payer_id: l.payer_id,
        student_name: l.student_name,
        cpf_digits: l.cpf_digits,
        phone_digits: l.phone_digits || "",
        drive_url: l.drive_url,
        due_date: l.due_date,
        amount_cents: l.amount_cents,
        digitable_line: l.digitable_line,
        our_number: l.our_number,
        file_id: l.file_id,
        view_url: l.view_url,
        source: l.read_source,
      }));

      const withOurNumber = payload.filter((p) => !!p.our_number);
      const withoutOurNumber = payload.filter((p) => !p.our_number);

      if (withOurNumber.length > 0) {
        const { error: upsertByOurError } = await (supabase as any)
          .from("payer_boleto_links")
          .upsert(withOurNumber, { onConflict: "our_number" });
        if (upsertByOurError) throw upsertByOurError;
      }

      if (withoutOurNumber.length > 0) {
        const { error: upsertByCpfUrlError } = await (supabase as any)
          .from("payer_boleto_links")
          .upsert(withoutOurNumber, { onConflict: "cpf_digits,drive_url" });
        if (upsertByCpfUrlError) throw upsertByCpfUrlError;
      }

      toast.success(`Importacao concluida: ${dedupedValid.length} linhas processadas${repeatedInFile > 0 ? `, ${repeatedInFile} repetidas no arquivo consolidadas` : ""}.`);
    } catch (error: any) {
      toast.error(`Erro na importacao: ${error?.message || "falha"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Portal de Boletos</h1>
            <p className="page-subtitle">
              Processe boletos do Drive ou importe links para disponibilizar 2ª via.
            </p>
          </div>

          <Tabs defaultValue="import" className="w-full">
            <TabsList>
              <TabsTrigger value="import" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar Links
              </TabsTrigger>
              <TabsTrigger value="drive" className="gap-2">
                <HardDrive className="h-4 w-4" />
                Processar Drive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="drive" className="mt-4">
              <DriveProcessorTab />
            </TabsContent>

            <TabsContent value="import" className="mt-4 space-y-6">

          {/* Stats Cards */}
          {lines.length > 0 && (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total linhas</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Match</p>
                    <p className="text-xl font-bold text-emerald-600">{stats.match}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2.5">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sem match</p>
                    <p className="text-xl font-bold text-destructive">{stats.noMatch}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2.5">
                    <Users className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Múltiplos</p>
                    <p className="text-xl font-bold">{stats.multiple}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2.5">
                    <LinkIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sem link/CPF</p>
                    <p className="text-xl font-bold">{stats.missingUrl + stats.missingData}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Import Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                Importar links (JSON / XLSX / CSV)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <input
                id="boletos-links-file"
                type="file"
                accept=".json,.xlsx,.xls,.csv"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => void handleFile(e.target.files?.[0] || null)}
              />
              <div
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isParsing ? (
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                )}
                <p className="mt-3 text-base font-medium">
                  {isParsing ? "Processando arquivo..." : "Arraste um arquivo aqui"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isParsing ? "Aguarde..." : "ou clique para selecionar · JSON, XLSX, CSV"}
                </p>
                {file && !isParsing && (
                  <Badge variant="secondary" className="mt-3">
                    <FileText className="h-3 w-3 mr-1" />
                    {file.name}
                  </Badge>
                )}
              </div>

              {/* Month coverage */}
              <Card className="border-dashed">
                <CardContent className="pt-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Cobertura do mês {referenceMonth}
                    </p>
                    {monthCoverage.expected > 0 && (
                      <Badge
                        variant={monthCoverage.missing.length === 0 ? "default" : "outline"}
                        className={monthCoverage.missing.length === 0
                          ? "bg-emerald-500/15 text-emerald-700 border-0"
                          : "text-destructive border-destructive/50"
                        }
                      >
                        {monthCoverage.linked}/{monthCoverage.expected}
                      </Badge>
                    )}
                  </div>

                  {monthCoverage.expected > 0 && (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (monthCoverage.linked / monthCoverage.expected) * 100)}%`,
                        }}
                      />
                    </div>
                  )}

                  {monthCoverage.missing.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="text-destructive font-medium">Faltando:</span>{" "}
                      {monthCoverage.missing.slice(0, 8).map((p) => p.name).join(", ")}
                      {monthCoverage.missing.length > 8 && ` +${monthCoverage.missing.length - 8}`}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={isSaving || isParsing || stats.match === 0}
                  className="gap-2"
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4" />Salvar {stats.match} link{stats.match !== 1 ? "s" : ""}</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setFile(null); setLines([]); }}
                  disabled={isParsing || isSaving}
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview Table */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Prévia</CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {filteredLines.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 px-0">
              <div className="grid gap-2 md:max-w-sm px-6">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchPreview}
                    onChange={(e) => setSearchPreview(e.target.value)}
                    placeholder="Buscar nome, CPF, link ou status"
                    className="pl-9"
                  />
                </div>
              </div>
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Aluno</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLines.map((line) => (
                      <TableRow key={line.id} className="group">
                        <TableCell className="pl-6 text-sm max-w-[180px] truncate font-medium">
                          {line.student_name || "–"}
                        </TableCell>
                        <TableCell className="font-mono text-xs tracking-wide">
                          {line.cpf_digits || "–"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.phone_digits || "–"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {line.reference_month || "–"}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {line.amount_cents != null
                            ? (line.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "–"}
                        </TableCell>
                        <TableCell>
                          {line.drive_url ? (
                            <a
                              href={line.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              abrir
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          {line.match_status === "MATCH" && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              Match
                            </Badge>
                          )}
                          {line.match_status === "NO_MATCH" && (
                            <Badge variant="outline" className="text-destructive border-destructive/50 gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" />
                              Sem match
                            </Badge>
                          )}
                          {line.match_status === "MISSING_URL" && (
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              <LinkIcon className="h-3 w-3" />
                              Sem link
                            </Badge>
                          )}
                          {line.match_status === "MISSING_DATA" && (
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              Sem CPF
                            </Badge>
                          )}
                          {line.match_status === "MULTIPLE" && (
                            <Badge variant="outline" className="text-amber-600 border-amber-500/50 gap-1 text-[11px]">
                              <Users className="h-3 w-3" />
                              Múltiplos
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                          {lines.length === 0
                            ? "Selecione um arquivo para visualizar a prévia."
                            : "Nenhum resultado para a busca."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
