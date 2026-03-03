import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import { useQuery } from "@tanstack/react-query";
import { useOptimizedImportPayers, useOptimizedImportBillings, useOptimizedImportCEPs } from "@/hooks/useOptimizedImport";
import { useInvoiceImport } from "@/hooks/useInvoiceImport";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { 
  Upload, 
  FileText, 
  Users, 
  MapPin, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  X,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { parseInvoiceSheet, ParsedInvoiceLine } from "@/lib/invoice-import";
import { parseCSV, transformBillingRow, BillingCSVRow } from "@/lib/csv-import";



type BillingPreviewType = "NEW" | "UPDATE_DUE_DATE" | "NO_CHANGE" | "MISSING_PAYER" | "NEW_STATUS_VARIANT";

type BillingPreviewRow = {
  type: BillingPreviewType;
  payerName: string;
  payerId: string;
  payerCode: string | null;
  referenceMonth: string;
  status: string;
  dueDate: string | null;
  nossoNumero: string | null;
  seuNumero: string | null;
  amountExpectedCents: number;
  note: string;
};

const getBillingPreviewBaseKey = (billing: {
  payer_id: string;
  reference_month: string;
  nosso_numero?: string | null;
  seu_numero?: string | null;
  due_date?: string | null;
}) => {
  const payer = billing.payer_id || "";
  const ref = billing.reference_month || "";
  const nosso = (billing.nosso_numero || "").trim();
  const seu = (billing.seu_numero || "").trim();
  const due = billing.due_date || "";

  if (nosso) return `${payer}|${ref}|NN|${nosso}`;
  if (seu) return `${payer}|${ref}|SEU|${seu}`;
  return `${payer}|${ref}|FALLBACK|${due}`;
};

const getBillingPreviewStatusKey = (billing: {
  payer_id: string;
  reference_month: string;
  nosso_numero?: string | null;
  seu_numero?: string | null;
  due_date?: string | null;
  status: string;
}) => `${getBillingPreviewBaseKey(billing)}|ST|${(billing.status || "").trim().toUpperCase()}`;

async function analyzeBillingPreview(file: File): Promise<BillingPreviewRow[]> {
  const rows = await parseCSV<BillingCSVRow>(file);
  const transformed = rows.map(transformBillingRow).filter(Boolean) as NonNullable<ReturnType<typeof transformBillingRow>>[];

  const incomingByStatus = new Map<string, NonNullable<ReturnType<typeof transformBillingRow>>>();
  for (const billing of transformed) {
    incomingByStatus.set(getBillingPreviewStatusKey(billing), billing);
  }
  const incoming = Array.from(incomingByStatus.values());

  const payerIds = Array.from(new Set(incoming.map((b) => b.payer_id).filter(Boolean)));
  const payerCodes = Array.from(new Set(incoming.map((b) => b.payer_code).filter((v): v is string => !!v)));

  let payerQuery = supabase.from("payers").select("id, name, payer_code");
  if (payerIds.length > 0 && payerCodes.length > 0) {
    payerQuery = payerQuery.or(`id.in.(${payerIds.join(",")}),payer_code.in.(${payerCodes.map((c) => `"${c}"`).join(",")})`);
  } else if (payerIds.length > 0) {
    payerQuery = payerQuery.in("id", payerIds);
  } else if (payerCodes.length > 0) {
    payerQuery = payerQuery.in("payer_code", payerCodes);
  }

  const { data: payers, error: payerErr } = await payerQuery;
  if (payerErr) throw payerErr;

  const payerById = new Map((payers || []).map((p) => [p.id, p]));
  const payerIdByCode = new Map((payers || []).filter((p) => p.payer_code).map((p) => [p.payer_code as string, p.id as string]));

  const resolvedIncoming = incoming.map((b) => {
    const resolvedPayerId = payerById.get(b.payer_id)?.id || (b.payer_code ? payerIdByCode.get(b.payer_code) : null) || b.payer_id;
    const payerMatch = payerById.get(resolvedPayerId);
    return {
      ...b,
      payer_id: resolvedPayerId,
      _payerFound: !!payerMatch,
      _payerName: payerMatch?.name || b.payer_name || `Pagador ${resolvedPayerId}`,
      _payerCode: payerMatch?.payer_code || b.payer_code || null,
    };
  });

  const resolvedPayerIds = Array.from(new Set(resolvedIncoming.map((b) => b.payer_id)));
  const { data: existingBillings, error: billingErr } = await supabase
    .from("billings")
    .select("payer_id, reference_month, nosso_numero, seu_numero, due_date, status")
    .in("payer_id", resolvedPayerIds.length > 0 ? resolvedPayerIds : ["__none__"]);
  if (billingErr) throw billingErr;

  const existingByStatusKey = new Map<string, (typeof existingBillings)[number]>();
  const existingByBaseKey = new Set<string>();

  (existingBillings || []).forEach((b) => {
    const statusKey = getBillingPreviewStatusKey({
      payer_id: b.payer_id,
      reference_month: b.reference_month,
      nosso_numero: b.nosso_numero,
      seu_numero: b.seu_numero,
      due_date: b.due_date,
      status: b.status,
    });
    existingByStatusKey.set(statusKey, b);
    existingByBaseKey.add(
      getBillingPreviewBaseKey({
        payer_id: b.payer_id,
        reference_month: b.reference_month,
        nosso_numero: b.nosso_numero,
        seu_numero: b.seu_numero,
        due_date: b.due_date,
      })
    );
  });

  return resolvedIncoming.map((b) => {
    const statusKey = getBillingPreviewStatusKey(b);
    const baseKey = getBillingPreviewBaseKey(b);
    const existing = existingByStatusKey.get(statusKey);

    if (!b._payerFound) {
      return {
        type: "MISSING_PAYER" as const,
        payerName: b._payerName,
        payerId: b.payer_id,
        payerCode: b._payerCode,
        referenceMonth: b.reference_month,
        status: b.status,
        dueDate: b.due_date,
        nossoNumero: b.nosso_numero,
        seuNumero: b.seu_numero,
        amountExpectedCents: b.amount_expected_cents,
        note: "Pagador nao encontrado. Sera criado automaticamente.",
      };
    }

    if (existing) {
      if ((existing.due_date || null) !== (b.due_date || null)) {
        return {
          type: "UPDATE_DUE_DATE" as const,
          payerName: b._payerName,
          payerId: b.payer_id,
          payerCode: b._payerCode,
          referenceMonth: b.reference_month,
          status: b.status,
          dueDate: b.due_date,
          nossoNumero: b.nosso_numero,
          seuNumero: b.seu_numero,
          amountExpectedCents: b.amount_expected_cents,
          note: `Vencimento sera atualizado de ${existing.due_date || "-"} para ${b.due_date || "-"}.`,
        };
      }

      return {
        type: "NO_CHANGE" as const,
        payerName: b._payerName,
        payerId: b.payer_id,
        payerCode: b._payerCode,
        referenceMonth: b.reference_month,
        status: b.status,
        dueDate: b.due_date,
        nossoNumero: b.nosso_numero,
        seuNumero: b.seu_numero,
        amountExpectedCents: b.amount_expected_cents,
        note: "Sem alteracoes em relacao ao banco.",
      };
    }

    if (existingByBaseKey.has(baseKey)) {
      return {
        type: "NEW_STATUS_VARIANT" as const,
        payerName: b._payerName,
        payerId: b.payer_id,
        payerCode: b._payerCode,
        referenceMonth: b.reference_month,
        status: b.status,
        dueDate: b.due_date,
        nossoNumero: b.nosso_numero,
        seuNumero: b.seu_numero,
        amountExpectedCents: b.amount_expected_cents,
        note: "Mesmo boleto base com status diferente. Historico sera mantido.",
      };
    }

    return {
      type: "NEW" as const,
      payerName: b._payerName,
      payerId: b.payer_id,
      payerCode: b._payerCode,
      referenceMonth: b.reference_month,
      status: b.status,
      dueDate: b.due_date,
      nossoNumero: b.nosso_numero,
      seuNumero: b.seu_numero,
      amountExpectedCents: b.amount_expected_cents,
      note: "Novo boleto a ser inserido.",
    };
  });
}

export default function Import() {
  const [activeTab, setActiveTab] = useState("pagadores");

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Importar</h1>
          <p className="page-subtitle">
            Importe dados de pagadores, boletos, faturas e CEPs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pagadores" className="gap-2">
              <Users className="h-4 w-4" />
              Pagadores
            </TabsTrigger>
            <TabsTrigger value="boletos" className="gap-2">
              <FileText className="h-4 w-4" />
              Boletos
            </TabsTrigger>
            <TabsTrigger value="faturas" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Faturas
            </TabsTrigger>
            <TabsTrigger value="ceps" className="gap-2">
              <MapPin className="h-4 w-4" />
              CEPs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pagadores">
            <ImportPayersCard />
          </TabsContent>

          <TabsContent value="boletos">
            <ImportBillingsCard />
          </TabsContent>

          <TabsContent value="faturas">
            <ImportInvoicesCard />
          </TabsContent>

          <TabsContent value="ceps">
            <ImportCEPsCard />
          </TabsContent>
        </Tabs>
      </PageTransition>
    </MainLayout>
  );
}

function ImportPayersCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { importPayers, isImporting, progress, reset } = useOptimizedImportPayers();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    await importPayers(file);
    setFile(null);
    reset();
  };

  const handleClear = () => {
    setFile(null);
    reset();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importar Pagadores
          </CardTitle>
          <CardDescription>
            Importe a lista de alunos/pagadores a partir de um arquivo CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DropZone
            file={file}
            isDragging={isDragging}
            isImporting={isImporting}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />

          {isImporting && <ProgressBar progress={progress} />}

          <div className="flex gap-2">
            {file && (
              <Button variant="ghost" onClick={handleClear} disabled={isImporting}>
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button onClick={handleImport} disabled={!file || isImporting} className="ml-auto">
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FieldsCard
        title="Campos Esperados"
        description="O arquivo CSV deve conter os seguintes campos"
        fields={["Nome", "Identif (CPF)", "Cod Pagador", "Endereco", "CEP", "Cidade", "UF", "Telefone", "Email"]}
        note="A importação é idempotente. Registros existentes serão atualizados, novos serão criados."
      />
    </div>
  );
}
function ImportBillingsCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<BillingPreviewRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<"ALL" | BillingPreviewType>("ALL");
  const { importBillings, isImporting, progress, reset } = useOptimizedImportBillings();

  const summary = useMemo(() => ({
    NEW: previewRows.filter((r) => r.type === "NEW").length,
    UPDATE_DUE_DATE: previewRows.filter((r) => r.type === "UPDATE_DUE_DATE").length,
    NEW_STATUS_VARIANT: previewRows.filter((r) => r.type === "NEW_STATUS_VARIANT").length,
    NO_CHANGE: previewRows.filter((r) => r.type === "NO_CHANGE").length,
    MISSING_PAYER: previewRows.filter((r) => r.type === "MISSING_PAYER").length,
  }), [previewRows]);

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === "ALL") return previewRows;
    return previewRows.filter((r) => r.type === previewFilter);
  }, [previewRows, previewFilter]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    try {
      const rows = await analyzeBillingPreview(file);
      setPreviewRows(rows);
      toast.success(`Analise concluida: ${rows.length} linhas comparadas.`);
    } catch (error: any) {
      toast.error(`Falha na analise: ${error.message || String(error)}`);
      setPreviewRows([]);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExportPreviewCsv = () => {
    if (filteredPreviewRows.length === 0) return;

    const header = [
      "tipo",
      "pagador",
      "payer_id",
      "payer_code",
      "referencia",
      "status",
      "vencimento",
      "nosso_numero",
      "seu_numero",
      "valor_centavos",
      "observacao",
    ];

    const rows = filteredPreviewRows.map((r) => [
      r.type,
      r.payerName,
      r.payerId,
      r.payerCode || "",
      r.referenceMonth,
      r.status,
      r.dueDate || "",
      r.nossoNumero || "",
      r.seuNumero || "",
      String(r.amountExpectedCents),
      r.note,
    ]);

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map((v) => escape(String(v))).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `preview-boletos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;
    await importBillings(file);
    setFile(null);
    setPreviewRows([]);
    setPreviewFilter("ALL");
    reset();
  };

  const handleClear = () => {
    setFile(null);
    setPreviewRows([]);
    setPreviewFilter("ALL");
    reset();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Boletos
          </CardTitle>
          <CardDescription>
            Importe boletos bancários e atualize status de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DropZone
            file={file}
            isDragging={isDragging}
            isImporting={isImporting}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />

          {isImporting && <ProgressBar progress={progress} />}

          <div className="flex flex-wrap gap-2">
            {file && (
              <Button variant="ghost" onClick={handleClear} disabled={isImporting || isPreviewing}>
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button variant="outline" onClick={handlePreview} disabled={!file || isImporting || isPreviewing}>
              {isPreviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Analisar alteracoes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleExportPreviewCsv} disabled={filteredPreviewRows.length === 0}>
              <FileText className="h-4 w-4 mr-2" />
              Exportar diferencas
            </Button>
            <Button onClick={handleImport} disabled={!file || isImporting} className="ml-auto">
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Confirmar importacao
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos Esperados</CardTitle>
          <CardDescription>O arquivo CSV deve conter os seguintes campos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["Nosso Numero", "Seu Numero", "Cod Pagador", "Data Vencimento", "Valor", "Data Baixa", "Data Pagamento"].map((field, index) => (
              <div key={field} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-medium text-accent">
                  {index + 1}
                </span>
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Regras de Status:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Data Pagamento</strong> → PAGO</li>
                <li>• <strong>Data Baixa (sem pagamento)</strong> → CANCELADO</li>
                <li>• <strong>Ambas as datas</strong> → REVISÃO</li>
                <li>• <strong>Nenhuma data</strong> → EM ABERTO</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex gap-2">
                <FileWarning className="h-5 w-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium text-accent">Reemissões</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se "Seu Número" contiver ANT ou ANTERIOR, será considerado mês anterior.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div>
                <CardTitle className="text-lg">Preview comparativo (sem grava??o)</CardTitle>
                <CardDescription>
                  Compare com a base atual antes de confirmar a importa??o.
                </CardDescription>
              </div>
              <Select value={previewFilter} onValueChange={(v) => setPreviewFilter(v as "ALL" | BillingPreviewType)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="NEW">Novos</SelectItem>
                  <SelectItem value="UPDATE_DUE_DATE">Vencimento alterado</SelectItem>
                  <SelectItem value="NEW_STATUS_VARIANT">Novo status (hist?rico)</SelectItem>
                  <SelectItem value="MISSING_PAYER">Sem cadastro</SelectItem>
                  <SelectItem value="NO_CHANGE">Sem mudan?as</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Novos: {summary.NEW}</Badge>
              <Badge variant="secondary">Vencimento: {summary.UPDATE_DUE_DATE}</Badge>
              <Badge variant="secondary">Novo status: {summary.NEW_STATUS_VARIANT}</Badge>
              <Badge variant="secondary">Sem cadastro: {summary.MISSING_PAYER}</Badge>
              <Badge variant="outline">Sem mudan?as: {summary.NO_CHANGE}</Badge>
            </div>

            <div className="max-h-[380px] overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Pagador</th>
                    <th className="text-left p-2">Ref.</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Venc.</th>
                    <th className="text-left p-2">Valor</th>
                    <th className="text-left p-2">Observa??o</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreviewRows.map((row, idx) => (
                    <tr key={`${row.payerId}-${row.nossoNumero || row.seuNumero || idx}`} className="border-t">
                      <td className="p-2"><Badge variant="outline">{row.type}</Badge></td>
                      <td className="p-2">{row.payerName}</td>
                      <td className="p-2">{row.referenceMonth}</td>
                      <td className="p-2">{row.status}</td>
                      <td className="p-2">{row.dueDate || "-"}</td>
                      <td className="p-2">R$ {(row.amountExpectedCents / 100).toFixed(2)}</td>
                      <td className="p-2">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function ImportInvoicesCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ParsedInvoiceLine[]>([]);
  const [parsedLines, setParsedLines] = useState<ParsedInvoiceLine[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState("manual");
  const [detectedCardLast4, setDetectedCardLast4] = useState<string | null>(null);
  const [invoiceMonthOverride, setInvoiceMonthOverride] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [provider, setProvider] = useState<"sicredi" | "generic">("sicredi");
  const costCenterCode = "GERAL";
  const category = "CARTAO_CREDITO";

  const isSpreadsheet = (f: File) => /\.xlsx?$/i.test(f.name);

  const { importInvoice, isImporting, progress, reset } = useInvoiceImport();

  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("id, name, card_last4, provider, closing_day, due_day, active")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as unknown as {
        id: string;
        name: string;
        card_last4: string | null;
        provider: string;
        closing_day: number | null;
        due_day: number | null;
        active: boolean;
      }[];
    },
  });

  useEffect(() => {
    if (selectedCardId === "manual") return;
    const selected = cards?.find((c) => c.id === selectedCardId);
    if (!selected) return;
    setProvider((selected.provider as "sicredi" | "generic") || "sicredi");
  }, [selectedCardId, cards]);

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (!invoiceMonthOverride) {
      toast.error("Informe o mês da fatura");
      return;
    }
    if (parsedLines.length === 0) {
      toast.error("Arquivo não processado ou sem linhas válidas");
      return;
    }

    const selectedCard = cards?.find((c) => c.id === selectedCardId);
    const cardId = selectedCard?.id || "NO_CARD";
    const cardName = selectedCard?.name || null;
    const closingDay = selectedCard?.closing_day ?? 9;
    const dueDay = selectedCard?.due_day ?? 15;

    try {
      await importInvoice({
        parsedLines,
        cardId,
        cardName,
        provider,
        invoiceMonthOverride,
        closingDay,
        dueDay,
        costCenterCode,
        category,
      });
      setFile(null);
      setParsedLines([]);
      setPreview([]);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClear = () => {
    setFile(null);
    setParsedLines([]);
    setPreview([]);
    setDetectedCardLast4(null);
    reset();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!isSpreadsheet(droppedFile)) {
        toast.error("Selecione um arquivo XLS ou XLSX");
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!isSpreadsheet(selectedFile)) {
        toast.error("Selecione um arquivo XLS ou XLSX");
        return;
      }
      setFile(selectedFile);
    }
  };
  
  useEffect(() => {
    if (!file) {
      setParsedLines([]);
      setPreview([]);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        setIsParsing(true);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][];
        const { lines, invoiceDueDate, cardLast4 } = parseInvoiceSheet(rows);
        if (invoiceDueDate) {
          const dueMonth = invoiceDueDate.slice(0, 7);
          setInvoiceMonthOverride(dueMonth);
        }
        if (cardLast4) {
          if (import.meta.env.DEV) {
            console.log("[ImportInvoices] detected card last4 from XLS:", cardLast4);
          }
          setDetectedCardLast4(cardLast4);
        }
        const parsed = lines;
        if (!active) return;
        setParsedLines(parsed);
        setPreview(parsed.slice(0, 50));
      } catch (err: any) {
        if (!active) return;
        toast.error(`Falha ao processar arquivo: ${err?.message ?? "erro inesperado"}`);
        setParsedLines([]);
        setPreview([]);
      } finally {
        if (!active) return;
        setIsParsing(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [file]);

  useEffect(() => {
    if (!detectedCardLast4 || !cards || cards.length === 0) return;
    const matched = cards.find((c) => c.card_last4 === detectedCardLast4);
    if (import.meta.env.DEV) {
      const cardSummary = cards.map((c) => ({
        id: c.id,
        name: c.name,
        card_last4: c.card_last4,
      }));
      console.log("[ImportInvoices] cards list for match:", cardSummary);
      console.log("[ImportInvoices] matched card:", matched || null);
    }
    if (matched) {
      setSelectedCardId(matched.id);
      setProvider((matched.provider as "sicredi" | "generic") || "sicredi");
    }
  }, [detectedCardLast4, cards]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Importar Faturas (XLS)
          </CardTitle>
          <CardDescription>
            Arquivo .xls com colunas: Data, Descricao, Parcela, Valor (R$)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DropZone
            file={file}
            isDragging={isDragging}
            isImporting={isImporting}
            accept=".xls,.xlsx"
            label="Arraste um arquivo XLS/XLSX aqui"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />

          {(isImporting || isParsing) && <ProgressBar progress={progress} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cartao cadastrado</Label>
              <Select
                value={selectedCardId}
                onValueChange={(v) => {
                  if (v === "manual") {
                    setSelectedCardId("manual");
                    setProvider("sicredi");
                    return;
                  }
                  setSelectedCardId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cartao (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Sem cartao</SelectItem>
                  {(cards || []).map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione um cartao cadastrado ou importe sem cartao.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Mes da fatura</Label>
              <Input
                type="month"
                placeholder="2026-02"
                value={invoiceMonthOverride}
                onChange={(e) => setInvoiceMonthOverride(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {file && (
              <Button variant="ghost" onClick={handleClear} disabled={isImporting || isParsing}>
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button
              className="ml-auto"
              onClick={handleImport}
              disabled={!file || isImporting || isParsing}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prévia</CardTitle>
          <CardDescription>
            Primeiras 50 linhas válidas do arquivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Sem prévia disponível</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-auto">
              <div className="sticky top-0 z-10 grid grid-cols-4 gap-3 rounded-lg border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Data</span>
                <span>Descricao</span>
                <span>Parcela</span>
                <span className="text-right">Valor (R$)</span>
              </div>
              {preview.map((p, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{p.purchaseDate}</span>
                  <span className="font-medium truncate">{p.description}</span>
                  <span>
                    {p.installmentTotal
                      ? `${p.installmentCurrent}/${p.installmentTotal}`
                      : "A vista"}
                  </span>
                  <span className="text-right tabular-nums">
                    {(p.amountCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportCEPsCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { importCEPs, isImporting, progress, reset } = useOptimizedImportCEPs();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    await importCEPs(file);
    setFile(null);
    reset();
  };

  const handleClear = () => {
    setFile(null);
    reset();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Importar CEPs
          </CardTitle>
          <CardDescription>
            Importe base de CEPs para lookup de endereços
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DropZone
            file={file}
            isDragging={isDragging}
            isImporting={isImporting}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
          />

          {isImporting && <ProgressBar progress={progress} />}

          <div className="flex gap-2">
            {file && (
              <Button variant="ghost" onClick={handleClear} disabled={isImporting}>
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button onClick={handleImport} disabled={!file || isImporting} className="ml-auto">
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <FieldsCard
        title="Campos Esperados"
        description="O arquivo CSV deve conter os seguintes campos"
        fields={["CEP", "Logradouro", "Bairro", "Cidade", "UF"]}
        note="CEPs duplicados serão atualizados com os novos dados."
      />
    </div>
  );
}

// Reusable components

function DropZone({
  file,
  isDragging,
  isImporting,
  accept = ".csv",
  label = "Arraste um arquivo CSV aqui",
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: {
  file: File | null;
  isDragging: boolean;
  isImporting: boolean;
  accept?: string;
  label?: string;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <motion.div
      animate={{ scale: isDragging ? 1.02 : 1 }}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        isDragging
          ? "border-accent bg-accent/5"
          : file
          ? "border-emerald-500 bg-emerald-500/5"
          : "border-border hover:border-muted-foreground/50"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={onFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isImporting}
      />
      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="space-y-2"
          >
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="space-y-2"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Importando...
        </span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </motion.div>
  );
}

function FieldsCard({
  title,
  description,
  fields,
  note,
}: {
  title: string;
  description: string;
  fields: string[];
  note: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-medium text-accent">
                {index + 1}
              </span>
              <span className="text-sm">{field}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600">Atenção</p>
              <p className="text-xs text-muted-foreground mt-1">{note}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}