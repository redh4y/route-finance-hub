import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, getCurrentMonthRef, formatMonthRef } from "@/lib/formatters";
import { parseCSV } from "@/lib/csv-import";
import { Upload, CheckCircle2, XCircle, Link2, Loader2, FileText, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExtractLine {
  date: string;
  description: string;
  amountCents: number;
  type: "C" | "D";
  raw: Record<string, string>;
}

interface MatchResult {
  extract: ExtractLine;
  matchedEntryId: string | null;
  matchedDescription: string | null;
  matchedAmountCents: number | null;
  confidence: "exact" | "partial" | "none";
}

function parseExtractCSV(rows: Record<string, string>[]): ExtractLine[] {
  return rows.map((row) => {
    const dateField = row["data"] || row["Data"] || row["DATA"] || row["date"] || "";
    const descField = row["descricao"] || row["Descricao"] || row["DESCRICAO"] || row["historico"] || row["Historico"] || row["description"] || "";
    const valueField = row["valor"] || row["Valor"] || row["VALOR"] || row["amount"] || "0";
    const typeField = (row["tipo"] || row["Tipo"] || row["TIPO"] || row["type"] || "").toUpperCase();

    const numericValue = parseFloat(
      valueField.replace(/[^\d,.-]/g, "").replace(",", ".")
    );
    const amountCents = Math.round(Math.abs(numericValue) * 100);
    const isDebit = typeField === "D" || typeField === "DEBITO" || numericValue < 0;

    return {
      date: dateField,
      description: descField,
      amountCents,
      type: isDebit ? "D" : "C",
      raw: row,
    };
  }).filter((l) => l.amountCents > 0 && l.description);
}

function matchEntries(
  extractLines: ExtractLine[],
  entries: Array<{ id: string; description: string; amount_cents: number; date: string; type: string }>
): MatchResult[] {
  return extractLines.map((ext) => {
    // Try exact amount match first
    const amountMatches = entries.filter(
      (e) => Math.abs(e.amount_cents - ext.amountCents) <= 1
    );

    if (amountMatches.length === 1) {
      return {
        extract: ext,
        matchedEntryId: amountMatches[0].id,
        matchedDescription: amountMatches[0].description,
        matchedAmountCents: amountMatches[0].amount_cents,
        confidence: "exact" as const,
      };
    }

    // Try partial match: same amount + similar description
    if (amountMatches.length > 1) {
      const descLower = ext.description.toLowerCase();
      const bestMatch = amountMatches.find((e) =>
        e.description.toLowerCase().includes(descLower.slice(0, 10)) ||
        descLower.includes(e.description.toLowerCase().slice(0, 10))
      );
      if (bestMatch) {
        return {
          extract: ext,
          matchedEntryId: bestMatch.id,
          matchedDescription: bestMatch.description,
          matchedAmountCents: bestMatch.amount_cents,
          confidence: "partial" as const,
        };
      }
    }

    return {
      extract: ext,
      matchedEntryId: null,
      matchedDescription: null,
      matchedAmountCents: null,
      confidence: "none" as const,
    };
  });
}

export default function Reconciliation() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [month, setMonth] = useState(getCurrentMonthRef());

  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }), []);

  const handleFile = async (f: File) => {
    setFile(f);
    setIsProcessing(true);
    setResults([]);

    try {
      const rows = await parseCSV<Record<string, string>>(f);
      const extractLines = parseExtractCSV(rows);

      if (!extractLines.length) {
        toast.error("Nenhuma linha válida encontrada no extrato");
        setIsProcessing(false);
        return;
      }

      // Fetch entries for this month
      const { data: entries, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount_cents, date, type")
        .eq("competence_month", month);

      if (error) throw error;

      const matched = matchEntries(extractLines, entries || []);
      setResults(matched);
      toast.success(`${extractLines.length} linhas processadas`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const stats = useMemo(() => {
    const exact = results.filter((r) => r.confidence === "exact").length;
    const partial = results.filter((r) => r.confidence === "partial").length;
    const none = results.filter((r) => r.confidence === "none").length;
    return { exact, partial, none, total: results.length };
  }, [results]);

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Conciliação Bancária</h1>
          <p className="page-subtitle">Importe o extrato e cruze com lançamentos financeiros</p>
        </div>

        <div className="space-y-6">
          {/* Upload + Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Extrato
              </CardTitle>
              <CardDescription>CSV com colunas: data, descricao, valor, tipo (C/D)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Mês de referência</label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m} value={m}>{formatMonthRef(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                  isDragging ? "border-accent bg-accent/5" : file ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Processando...</span>
                  </div>
                ) : file ? (
                  <div className="space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">Clique para trocar</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="font-medium">Arraste o extrato CSV aqui</p>
                    <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-primary">{stats.exact}</p>
                    <p className="text-xs text-muted-foreground">Conciliados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-warning">{stats.partial}</p>
                    <p className="text-xs text-muted-foreground">Parciais</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 px-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{stats.none}</p>
                    <p className="text-xs text-muted-foreground">Sem match</p>
                  </CardContent>
                </Card>
              </div>

              {/* Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Extrato</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {r.confidence === "exact" ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                                </Badge>
                              ) : r.confidence === "partial" ? (
                                <Badge className="bg-warning/10 text-warning border-warning/20">
                                  <AlertCircle className="h-3 w-3 mr-1" /> Parcial
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-destructive border-destructive/20">
                                  <XCircle className="h-3 w-3 mr-1" /> Sem match
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{r.extract.date}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs">{r.extract.description}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              <span className={r.extract.type === "C" ? "text-primary" : "text-destructive"}>
                                {r.extract.type === "D" ? "-" : "+"}{formatCurrency(r.extract.amountCents)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {r.matchedDescription || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}
