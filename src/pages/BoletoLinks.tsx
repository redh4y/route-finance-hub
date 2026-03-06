import { useMemo, useState } from "react";
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
import { Upload, Loader2, Link as LinkIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type PayerLite = {
  id: string;
  name: string;
  document_digits: string | null;
  phone: string | null;
};

type ParsedLine = {
  id: string;
  raw: string;
  student_name: string | null;
  drive_url: string | null;
  payer_id: string | null;
  cpf_digits: string | null;
  phone_digits: string | null;
  match_status: "MATCH" | "NO_MATCH" | "MISSING_URL" | "MISSING_DATA" | "MULTIPLE";
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
  const [lines, setLines] = useState<ParsedLine[]>([]);

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

  const stats = useMemo(() => {
    const total = lines.length;
    const match = lines.filter((l) => l.match_status === "MATCH").length;
    const noMatch = lines.filter((l) => l.match_status === "NO_MATCH").length;
    const multiple = lines.filter((l) => l.match_status === "MULTIPLE").length;
    const missingUrl = lines.filter((l) => l.match_status === "MISSING_URL").length;
    const missingData = lines.filter((l) => l.match_status === "MISSING_DATA").length;
    return { total, match, noMatch, multiple, missingUrl, missingData };
  }, [lines]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setFile(f);
    setIsParsing(true);
    try {
      const rows = await readRows(f);

      const parsed = rows.map((raw, idx): ParsedLine => {
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
            match_status: "NO_MATCH",
          };
        }

        const payer = matches[0].payer;
        const cpf = normalizeDigits(payer.document_digits);
        const phone = normalizeDigits(payer.phone);

        if (!cpf || !phone) {
          return {
            id: String(idx),
            raw,
            student_name: studentName,
            drive_url: driveUrl,
            payer_id: payer.id,
            cpf_digits: cpf || null,
            phone_digits: phone || null,
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
          phone_digits: phone,
          match_status: "MATCH",
        };
      });

      setLines(parsed);
      toast.success(`Arquivo lido: ${parsed.length} linhas.`);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao ler arquivo");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    const valid = lines.filter((l) => l.match_status === "MATCH" && l.drive_url && l.cpf_digits && l.phone_digits);
    if (valid.length === 0) {
      toast.error("Nenhuma linha valida para importar.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = valid.map((l) => ({
        reference_month: referenceMonth,
        payer_id: l.payer_id,
        student_name: l.student_name,
        cpf_digits: l.cpf_digits,
        phone_digits: l.phone_digits,
        drive_url: l.drive_url,
        created_at: new Date().toISOString(),
      }));

      const { error } = await (supabase as any)
        .from("payer_boleto_links")
        .upsert(payload, { onConflict: "reference_month,cpf_digits,phone_digits,drive_url", ignoreDuplicates: false });

      if (error) throw error;

      toast.success(`Importacao concluida: ${valid.length} links salvos.`);
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
          <div className="page-header">
            <h1 className="page-title">Portal de Boletos</h1>
            <p className="page-subtitle">Importe links de boletos para disponibilizar 2a via por WhatsApp + CPF.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Importar links (XLSX/CSV)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Competencia (YYYY-MM)</Label>
                  <Input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Total: {stats.total}</Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Match: {stats.match}</Badge>
                <Badge variant="outline" className="text-destructive border-destructive/50">Sem match: {stats.noMatch}</Badge>
                <Badge variant="outline" className="text-warning border-warning/50">Multiplos: {stats.multiple}</Badge>
                <Badge variant="outline">Sem link: {stats.missingUrl}</Badge>
                <Badge variant="outline">Sem CPF/WhatsApp: {stats.missingData}</Badge>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={isSaving || isParsing || stats.match === 0}>
                  {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : <><Upload className="h-4 w-4 mr-2" />Salvar links</>}
                </Button>
                <Button variant="outline" onClick={() => { setFile(null); setLines([]); }} disabled={isParsing || isSaving}>Limpar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.student_name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{line.cpf_digits || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{line.phone_digits || "-"}</TableCell>
                        <TableCell>
                          {line.drive_url ? (
                            <a href={line.drive_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-xs underline">
                              <LinkIcon className="h-3 w-3" /> abrir
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {line.match_status === "MATCH" && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Match</Badge>}
                          {line.match_status === "NO_MATCH" && <Badge variant="outline" className="text-destructive border-destructive/50"><AlertTriangle className="h-3 w-3 mr-1" />Sem match</Badge>}
                          {line.match_status === "MISSING_URL" && <Badge variant="outline">Sem link</Badge>}
                          {line.match_status === "MISSING_DATA" && <Badge variant="outline">Sem CPF/WhatsApp</Badge>}
                          {line.match_status === "MULTIPLE" && <Badge variant="outline" className="text-warning border-warning/50">Multiplos</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Selecione um arquivo para visualizar a previa.</TableCell>
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
