import { Fragment, useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, CheckCircle2, Clock, Copy, Download, Eye,
  FileText, Loader2, Search, Shield, XCircle,
} from "lucide-react";

/* ───── Types ───── */

type PublicBoletoItem = {
  reference_month: string;
  student_name: string;
  drive_url: string;
  due_date?: string | null;
  amount_cents?: number | null;
  our_number?: string | null;
  digitable_line?: string | null;
  billing_status?: string | null;
  public_status?: string | null;
};

/* ───── Helpers ───── */

function onlyDigits(input: string) {
  return input.replace(/\D/g, "");
}

function formatCpfMask(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function getDrivePreviewUrl(url: string) {
  const direct = String(url || "").trim();
  if (!direct) return null;
  const byFilePath = direct.match(/\/file\/d\/([^/]+)/i);
  if (byFilePath?.[1]) return `https://drive.google.com/file/d/${byFilePath[1]}/preview`;
  const byIdQuery = direct.match(/[?&]id=([^&]+)/i);
  if (byIdQuery?.[1]) return `https://drive.google.com/file/d/${byIdQuery[1]}/preview`;
  return null;
}

function formatMonth(ref: string) {
  if (!ref || !/^\d{4}-\d{2}$/.test(ref)) return ref;
  const [y, m] = ref.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  return `${label.charAt(0).toUpperCase() + label.slice(1)}/${y}`;
}

function formatDateBR(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "–";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number") return "–";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getStatusInfo(status: string | null | undefined) {
  const s = String(status || "").toUpperCase();
  if (s === "PAGO")
    return { label: "Pago", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
  if (s === "EM_ABERTO")
    return { label: "Em aberto", icon: Clock, cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  if (s === "VENCIDO")
    return { label: "Vencido", icon: AlertTriangle, cls: "bg-destructive/15 text-destructive border-destructive/30" };
  if (s === "CANCELADO")
    return { label: "Cancelado", icon: XCircle, cls: "bg-muted text-muted-foreground border-border" };
  if (s === "REVISAO")
    return { label: "Em revisão", icon: AlertTriangle, cls: "bg-purple-500/15 text-purple-700 border-purple-500/30" };
  return { label: "Sem status", icon: FileText, cls: "bg-muted text-muted-foreground border-border" };
}

function canShowDigitableLine(status: string | null | undefined) {
  const s = String(status || "").toUpperCase();
  return s !== "PAGO" && s !== "CANCELADO";
}

function sortBills(items: PublicBoletoItem[]) {
  return [...items].sort((a, b) => {
    const ad = String(a.due_date || "");
    const bd = String(b.due_date || "");
    if (ad !== bd) return bd.localeCompare(ad);
    return String(b.reference_month || "").localeCompare(String(a.reference_month || ""));
  });
}

/* ───── Component ───── */

export default function PublicBoletoLinksPage() {
  const [cpf, setCpf] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [items, setItems] = useState<PublicBoletoItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null);
  const [previewReferenceMonth, setPreviewReferenceMonth] = useState<string | null>(null);
  const [previewStudentName, setPreviewStudentName] = useState<string | null>(null);

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf]);
  const canSearch = cpfDigits.length === 11;
  const welcomeName = items[0]?.student_name || "";

  const logDownload = async (params: { driveUrl: string; referenceMonth?: string | null; studentName?: string | null }) => {
    try {
      await supabase.functions.invoke("public-boleto-links", {
        body: { action: "log_download", cpf: cpfDigits, driveUrl: params.driveUrl, referenceMonth: params.referenceMonth || null, studentName: params.studentName || null },
      });
    } catch { /* best effort */ }
  };

  const handleDownloadClick = async (
    e: MouseEvent<HTMLAnchorElement>,
    params: { driveUrl: string; referenceMonth?: string | null; studentName?: string | null },
  ) => {
    e.preventDefault();
    await logDownload(params);
    window.open(params.driveUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyDigitableLine = async (line: string | null | undefined) => {
    const value = String(line || "").trim();
    if (!value) { toast.error("Código de barras indisponível para este boleto."); return; }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código de barras copiado!");
    } catch { toast.error("Não foi possível copiar o código de barras."); }
  };

  const openPreview = (item: PublicBoletoItem) => {
    const preview = getDrivePreviewUrl(item.drive_url);
    if (!preview) { toast.error("Link do Google Drive inválido para pré-visualização."); return; }
    setPreviewUrl(preview);
    setPreviewDownloadUrl(item.drive_url);
    setPreviewReferenceMonth(item.reference_month);
    setPreviewStudentName(item.student_name || "Aluno");
  };

  const handleSearchBills = async () => {
    if (!canSearch) { toast.error("Informe um CPF válido."); return; }
    setIsLoading(true);
    setItems([]);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-boleto-links", {
        body: { action: "list_bills", cpf: cpfDigits },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na consulta");
      const foundItems = sortBills((data.items || []) as PublicBoletoItem[]);
      setItems(foundItems);
      if (foundItems.length === 0) toast.warning("Nenhum boleto encontrado para o CPF informado.");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao buscar boletos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSearch && !isLoading) handleSearchBills();
  };




  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-10 md:py-14 text-center space-y-3">
          <div className="inline-flex items-center justify-center rounded-full bg-primary-foreground/10 p-3 mb-2">
            <FileText className="h-8 w-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            2ª via de boletos
          </h1>
          <p className="text-primary-foreground/70 text-sm md:text-base max-w-md mx-auto">
            Consulte e baixe seus boletos de forma rápida e segura.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 -mt-6 pb-12 space-y-5">
        {/* Welcome banner */}
        {welcomeName && (
          <div className="flex items-center gap-3 rounded-2xl bg-card shadow-lg border-0 px-5 py-4">
            <div className="flex items-center justify-center rounded-full bg-emerald-500/15 h-10 w-10 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold">Olá, {welcomeName}!</p>
              <p className="text-xs text-muted-foreground">
                {items.length} boleto{items.length !== 1 ? "s" : ""} encontrado{items.length !== 1 ? "s" : ""} para o seu CPF.
              </p>
            </div>
          </div>
        )}

        {/* Search Card */}
        <Card className="shadow-lg border-0">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={cpf}
                  onChange={(e) => { setCpf(formatCpfMask(e.target.value)); setItems([]); setHasSearched(false); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite seu CPF: 000.000.000-00"
                  disabled={isLoading}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Button
                onClick={handleSearchBills}
                disabled={!canSearch || isLoading}
                className="h-12 px-6 text-base shrink-0"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Buscar boletos</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            Antes de pagar, confira atentamente os dados: <strong>nome</strong>, <strong>CPF</strong>, <strong>vencimento</strong> e <strong>valor</strong>.
          </p>
        </div>


        {/* Results */}
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="rounded-xl border p-4 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-32 rounded bg-muted" />
                      <div className="h-5 w-20 rounded bg-muted" />
                    </div>
                    <div className="flex gap-4">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-4 w-20 rounded bg-muted" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-28 rounded bg-muted" />
                      <div className="h-9 w-24 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-12 space-y-2">
                <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Informe seu CPF acima para consultar seus boletos.
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhum boleto encontrado para o CPF informado.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const st = getStatusInfo(item.public_status);
                        const StIcon = st.icon;
                        const showBarcode = canShowDigitableLine(item.public_status) && item.digitable_line;
                        return (
                          <Fragment key={`${item.reference_month}-${item.our_number || idx}`}>
                            <TableRow className={cn("border-b-0", showBarcode && "")}>
                              <TableCell className="font-medium">
                                {formatMonth(item.reference_month)}
                              </TableCell>
                              <TableCell>{formatDateBR(item.due_date)}</TableCell>
                              <TableCell className="font-semibold tabular-nums">
                                {formatCurrency(item.amount_cents)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("gap-1 text-[11px] border", st.cls)}>
                                  <StIcon className="h-3 w-3" />
                                  {st.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openPreview(item)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <a href={item.drive_url} target="_blank" rel="noreferrer"
                                    onClick={(e) => handleDownloadClick(e, { driveUrl: item.drive_url, referenceMonth: item.reference_month, studentName: item.student_name || "Aluno" })}
                                  >
                                    <Button size="sm" className="gap-1.5 h-8">
                                      <Download className="h-3.5 w-3.5" />
                                      Baixar
                                    </Button>
                                  </a>
                                </div>
                              </TableCell>
                            </TableRow>
                            {showBarcode && (
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={5} className="pt-1 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-[11px] font-mono rounded-md border bg-card px-2.5 py-1 break-all cursor-copy hover:bg-muted/50 transition-colors"
                                      onClick={() => handleCopyDigitableLine(item.digitable_line)}
                                      title="Clique para copiar"
                                    >
                                      {item.digitable_line}
                                    </span>
                                    <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0"
                                      onClick={() => handleCopyDigitableLine(item.digitable_line)}
                                    >
                                      <Copy className="h-3 w-3" />
                                      Copiar
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {items.map((item, idx) => {
                    const st = getStatusInfo(item.public_status);
                    const StIcon = st.icon;
                    const showBarcode = canShowDigitableLine(item.public_status) && item.digitable_line;
                    return (
                      <div
                        key={`${item.reference_month}-${item.our_number || idx}`}
                        className="rounded-xl border bg-card p-4 space-y-3"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-lg">
                            {formatMonth(item.reference_month)}
                          </p>
                          <Badge variant="outline" className={cn("gap-1 text-[11px] border shrink-0", st.cls)}>
                            <StIcon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </div>

                        {/* Info */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Vencimento</p>
                            <p className="text-sm font-medium">{formatDateBR(item.due_date)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor</p>
                            <p className="text-sm font-bold">{formatCurrency(item.amount_cents)}</p>
                          </div>
                        </div>

                        {/* Barcode */}
                        {showBarcode && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                              Código de barras
                            </p>
                            <span
                              className="text-[11px] font-mono rounded-lg border bg-muted/50 px-3 py-2.5 break-all block cursor-copy active:bg-muted transition-colors"
                              onClick={() => handleCopyDigitableLine(item.digitable_line)}
                            >
                              {item.digitable_line}
                            </span>
                            <Button
                              size="sm" variant="outline"
                              className="gap-1.5 w-full h-10"
                              onClick={() => handleCopyDigitableLine(item.digitable_line)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar código de barras
                            </Button>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button size="sm" variant="outline" className="gap-1.5 h-11" onClick={() => openPreview(item)}>
                            <Eye className="h-4 w-4" />
                            Visualizar
                          </Button>
                          <a href={item.drive_url} target="_blank" rel="noreferrer"
                            onClick={(e) => handleDownloadClick(e, { driveUrl: item.drive_url, referenceMonth: item.reference_month, studentName: item.student_name || "Aluno" })}
                          >
                            <Button size="sm" className="gap-1.5 w-full h-11">
                              <Download className="h-4 w-4" />
                              Baixar boleto
                            </Button>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer / Contact */}
        <div className="text-center space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Precisa de ajuda ou quer alterar um boleto?
          </p>
          <a
            href="https://wa.me/5517981606721"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Falar pelo WhatsApp
          </a>
          <p className="text-[11px] text-muted-foreground/60 pt-2">
            Tavares Transportes · Seus dados são protegidos.
          </p>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewUrl(null);
            setPreviewDownloadUrl(null);
            setPreviewReferenceMonth(null);
            setPreviewStudentName(null);
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-6xl h-[95vh] !p-0 !gap-0 !flex !flex-col min-h-0 overflow-hidden [&>button]:right-2 [&>button]:top-2">
          <div className="w-full shrink-0 border-b px-4 py-3 pr-10 flex items-center justify-between gap-3">
            <DialogTitle className="m-0 text-base">
              Pré-visualização do boleto
            </DialogTitle>
            {previewDownloadUrl && (
              <a
                href={previewDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
                onClick={(e) => handleDownloadClick(e, { driveUrl: previewDownloadUrl, referenceMonth: previewReferenceMonth, studentName: previewStudentName })}
              >
                <Button size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" /> Baixar
                </Button>
              </a>
            )}
          </div>
          {previewUrl && (
            <div className="flex-1 min-h-0 bg-muted">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Pré-visualização do boleto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
