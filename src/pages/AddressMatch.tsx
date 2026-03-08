import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import {
  MapPin,
  Upload,
  Download,
  Play,
  Settings2,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Database,
  FileText,
  Info,
} from "lucide-react";

// ── Types ──
interface MatchConfig {
  bairro_fuzzy_threshold: number;
  min_score_logradouro: number;
  token_threshold: number;
  ambiguous_gap: number;
  token_weight: number;
  seq_weight: number;
  fallback_global: boolean;
}

interface Summary {
  total: number;
  matched: number;
  review: number;
  failed: number;
}

interface BairroDiag {
  bairro: string;
  count: number;
  gate: string;
}

interface Failure {
  endereco: string;
  bairro_gate: string;
  bairro_score: number;
  logradouro_score: number;
  review_reason: string;
}

interface MatchResponse {
  results: Record<string, unknown>[];
  summary: Summary;
  diagnostics: { topBairros: BairroDiag[]; failures: Failure[] };
  config: MatchConfig;
  cep_base_size: number;
  bairro_index_size: number;
}

const DEFAULT_CONFIG: MatchConfig = {
  bairro_fuzzy_threshold: 0.405,
  min_score_logradouro: 0.50,
  token_threshold: 0.82,
  ambiguous_gap: 0.05,
  token_weight: 0.45,
  seq_weight: 0.55,
  fallback_global: false,
};

export default function AddressMatch() {
  // Files
  const [payersFile, setPayersFile] = useState<File | null>(null);
  const [cepsFile, setCepsFile] = useState<File | null>(null);
  const [payersData, setPayersData] = useState<Record<string, unknown>[]>([]);
  const [cepsData, setCepsData] = useState<Record<string, unknown>[]>([]);
  const [enderecoCol, setEnderecoCol] = useState("Endereco");
  const [useDbCeps, setUseDbCeps] = useState(true);

  // Config
  const [config, setConfig] = useState<MatchConfig>({ ...DEFAULT_CONFIG });

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<MatchResponse | null>(null);

  const payersCols = useMemo(() => {
    if (payersData.length === 0) return [];
    return Object.keys(payersData[0]);
  }, [payersData]);

  // ── CSV parsing ──
  const handleFile = useCallback(
    (file: File, setter: (d: Record<string, unknown>[]) => void, fileSetter: (f: File) => void) => {
      fileSetter(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (result) => {
          setter(result.data as Record<string, unknown>[]);
          toast.success(`${file.name}: ${result.data.length} linhas carregadas`);
        },
        error: () => toast.error(`Erro ao ler ${file.name}`),
      });
    },
    []
  );

  // ── Run match ──
  const runMatch = async () => {
    if (payersData.length === 0) {
      toast.error("Carregue o CSV de pagadores primeiro");
      return;
    }
    if (!useDbCeps && cepsData.length === 0) {
      toast.error("Carregue a base de CEPs ou ative a opção de usar o banco");
      return;
    }

    setIsProcessing(true);
    setResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("address-match", {
        body: {
          payers_csv: payersData,
          ceps_csv: cepsData.length > 0 ? cepsData : undefined,
          use_db_ceps: useDbCeps,
          config,
          endereco_column: enderecoCol,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResponse(data as MatchResponse);
      toast.success(
        `Processamento concluído: ${data.summary.matched} matches de ${data.summary.total}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── CSV download ──
  const downloadCsv = () => {
    if (!response?.results) return;
    const csv = Papa.unparse(response.results);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match_enderecos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = response?.summary;
  const matchPct = summary ? Math.round((summary.matched / Math.max(summary.total, 1)) * 100) : 0;

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                Match de Endereços
              </h1>
              <p className="text-muted-foreground text-sm">
                Normalização e ancoragem de bairro + logradouro com auditoria completa
              </p>
            </div>
            {response && (
              <Button onClick={downloadCsv} className="gap-2 self-start">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            )}
          </div>

          {/* Upload + Config */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Upload */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Arquivos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>CSV de Pagadores *</Label>
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f, setPayersData, setPayersFile);
                      }}
                    />
                    {payersFile && (
                      <p className="text-xs text-muted-foreground">
                        {payersFile.name} — {payersData.length} linhas
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Base de CEPs (opcional)
                      <span className="text-muted-foreground text-xs ml-1">complementa o banco</span>
                    </Label>
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f, setCepsData, setCepsFile);
                      }}
                    />
                    {cepsFile && (
                      <p className="text-xs text-muted-foreground">
                        {cepsFile.name} — {cepsData.length} linhas
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-2 flex-1">
                    <Label>Coluna de endereço</Label>
                    {payersCols.length > 0 ? (
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={enderecoCol}
                        onChange={(e) => setEnderecoCol(e.target.value)}
                      >
                        {payersCols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={enderecoCol}
                        onChange={(e) => setEnderecoCol(e.target.value)}
                        placeholder="Nome da coluna"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch checked={useDbCeps} onCheckedChange={setUseDbCeps} id="use-db" />
                    <Label htmlFor="use-db" className="flex items-center gap-1 text-sm cursor-pointer">
                      <Database className="h-3.5 w-3.5" />
                      Usar base do banco
                    </Label>
                  </div>
                </div>

                <Button
                  onClick={runMatch}
                  disabled={isProcessing || payersData.length === 0}
                  className="w-full sm:w-auto gap-2"
                  size="lg"
                >
                  {isProcessing ? (
                    <>Processando...</>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Executar Match ({payersData.length} linhas)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Config sliders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Thresholds
                </CardTitle>
                <CardDescription className="text-xs">
                  Pesos: token {config.token_weight} / seq {config.seq_weight}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <SliderField
                  label="Bairro fuzzy"
                  value={config.bairro_fuzzy_threshold}
                  min={0.1}
                  max={0.9}
                  step={0.001}
                  onChange={(v) => setConfig((c) => ({ ...c, bairro_fuzzy_threshold: v }))}
                />
                <SliderField
                  label="Min score logradouro"
                  value={config.min_score_logradouro}
                  min={0.1}
                  max={0.9}
                  step={0.01}
                  onChange={(v) => setConfig((c) => ({ ...c, min_score_logradouro: v }))}
                />
                <SliderField
                  label="Token threshold"
                  value={config.token_threshold}
                  min={0.5}
                  max={1}
                  step={0.01}
                  onChange={(v) => setConfig((c) => ({ ...c, token_threshold: v }))}
                />
                <SliderField
                  label="Ambiguous gap"
                  value={config.ambiguous_gap}
                  min={0.01}
                  max={0.2}
                  step={0.005}
                  onChange={(v) => setConfig((c) => ({ ...c, ambiguous_gap: v }))}
                />
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={config.fallback_global}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, fallback_global: v }))}
                    id="fallback"
                  />
                  <Label htmlFor="fallback" className="text-sm cursor-pointer">
                    Fallback global
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <Card>
              <CardContent className="py-8 flex flex-col items-center gap-3">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                <p className="text-sm text-muted-foreground">Processando {payersData.length} endereços...</p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {response && (
            <>
              {/* Summary cards */}
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Total"
                  value={summary!.total}
                  icon={FileText}
                  color="text-foreground"
                />
                <SummaryCard
                  label="Match OK"
                  value={summary!.matched}
                  icon={CheckCircle2}
                  color="text-emerald-600"
                  pct={matchPct}
                />
                <SummaryCard
                  label="Revisão"
                  value={summary!.review}
                  icon={AlertTriangle}
                  color="text-amber-600"
                />
                <SummaryCard
                  label="Falha"
                  value={summary!.failed}
                  icon={XCircle}
                  color="text-red-600"
                />
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Base CEPs: {response.cep_base_size} registros
                </span>
                <span>Bairros únicos: {response.bairro_index_size}</span>
                <span>
                  Pesos: token={response.config.token_weight} / seq={response.config.seq_weight}
                </span>
              </div>

              {/* Tabs: Results, Bairros, Failures */}
              <Tabs defaultValue="results">
                <TabsList>
                  <TabsTrigger value="results" className="gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Resultados
                  </TabsTrigger>
                  <TabsTrigger value="bairros" className="gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Bairros
                  </TabsTrigger>
                  <TabsTrigger value="failures" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Falhas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Endereço</TableHead>
                            <TableHead>Bairro Gate</TableHead>
                            <TableHead>Bairro Score</TableHead>
                            <TableHead>Log. Score</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead className="min-w-[200px]">Endereço Canônico</TableHead>
                            <TableHead>CEP</TableHead>
                            <TableHead>Review</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.results.slice(0, 200).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[250px] truncate">
                                {String(r.endereco_usado || "")}
                              </TableCell>
                              <TableCell>
                                <GateBadge gate={String(r.bairro_gate || "")} />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {Number(r.bairro_score || 0).toFixed(3)}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {Number(r.logradouro_score || 0).toFixed(3)}
                              </TableCell>
                              <TableCell>
                                {r.match_ok ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell className="text-xs max-w-[250px] truncate">
                                {String(r.matched_endereco_completo || "—")}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {String(r.matched_cep || "")}
                              </TableCell>
                              <TableCell>
                                {r.review_status === "REVIEW" && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-500/40">
                                    {String(r.review_reason || "REVIEW")}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {response.results.length > 200 && (
                      <p className="text-xs text-muted-foreground p-3 border-t">
                        Mostrando 200 de {response.results.length}. Exporte o CSV para ver todos.
                      </p>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="bairros">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bairro candidato</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead>Gate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.diagnostics.topBairros.map((b, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{b.bairro}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                              <TableCell>
                                <GateBadge gate={b.gate} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </TabsContent>

                <TabsContent value="failures">
                  <Card>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[250px]">Endereço</TableHead>
                            <TableHead>Bairro Gate</TableHead>
                            <TableHead>Bairro Score</TableHead>
                            <TableHead>Log. Score</TableHead>
                            <TableHead>Motivo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {response.diagnostics.failures.map((f, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[300px] truncate">{f.endereco}</TableCell>
                              <TableCell>
                                <GateBadge gate={f.bairro_gate} />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {f.bairro_score.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {f.logradouro_score.toFixed(3)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {f.review_reason}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {response.diagnostics.failures.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                Nenhuma falha encontrada 🎉
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </PageTransition>
    </MainLayout>
  );
}

// ── Sub-components ──

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{value.toFixed(3)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  pct,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  pct?: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">
            {label}
            {pct !== undefined && ` (${pct}%)`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GateBadge({ gate }: { gate: string }) {
  const map: Record<string, string> = {
    EXACT: "border-emerald-500/40 text-emerald-600 bg-emerald-500/5",
    FUZZY: "border-amber-500/40 text-amber-600 bg-amber-500/5",
    FAIL: "border-red-500/40 text-red-600 bg-red-500/5",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${map[gate] || ""}`}>
      {gate || "—"}
    </Badge>
  );
}
