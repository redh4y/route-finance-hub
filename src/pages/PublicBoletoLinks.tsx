import { Fragment, useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Loader2,
  XCircle,
} from "lucide-react";

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
  if (byFilePath?.[1]) {
    return `https://drive.google.com/file/d/${byFilePath[1]}/preview`;
  }

  const byIdQuery = direct.match(/[?&]id=([^&]+)/i);
  if (byIdQuery?.[1]) {
    return `https://drive.google.com/file/d/${byIdQuery[1]}/preview`;
  }

  return null;
}

function formatMonth(ref: string) {
  if (!ref || !/^\d{4}-\d{2}$/.test(ref)) return ref;
  const [y, m] = ref.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    date,
  );
  const monthName = label.charAt(0).toUpperCase() + label.slice(1);
  return `${monthName}/${y}`;
}

function formatDateBR(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "-";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number") return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getPublicStatusBadge(status: string | null | undefined) {
  const normalized = String(status || "SEM_STATUS").toUpperCase();

  if (normalized === "PAGO") {
    return { label: "Pago", className: "badge-paid", Icon: CheckCircle2 };
  }

  if (normalized === "EM_ABERTO") {
    return { label: "Em aberto", className: "badge-open", Icon: AlertTriangle };
  }

  if (normalized === "VENCIDO") {
    return { label: "Vencido", className: "badge-open", Icon: AlertTriangle };
  }

  if (normalized === "CANCELADO") {
    return { label: "Cancelado", className: "badge-cancelled", Icon: XCircle };
  }

  if (normalized === "REVISAO") {
    return { label: "Revis?o", className: "badge-review", Icon: AlertTriangle };
  }

  return { label: "Sem status", className: "badge-open", Icon: AlertTriangle };
}

function canShowDigitableLine(status: string | null | undefined) {
  const normalized = String(status || "").toUpperCase();
  return normalized !== "PAGO" && normalized !== "CANCELADO";
}

function sortBills(items: PublicBoletoItem[]) {
  return [...items].sort((a, b) => {
    const ad = String(a.due_date || "");
    const bd = String(b.due_date || "");
    if (ad !== bd) return bd.localeCompare(ad);
    return String(b.reference_month || "").localeCompare(
      String(a.reference_month || ""),
    );
  });
}

export default function PublicBoletoLinksPage() {
  const [cpf, setCpf] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PublicBoletoItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(
    null,
  );
  const [previewReferenceMonth, setPreviewReferenceMonth] = useState<
    string | null
  >(null);
  const [previewStudentName, setPreviewStudentName] = useState<string | null>(
    null,
  );

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf]);
  const canSearch = cpfDigits.length === 11;
  const welcomeName = items[0]?.student_name || "";

  const logDownload = async (params: {
    driveUrl: string;
    referenceMonth?: string | null;
    studentName?: string | null;
  }) => {
    try {
      await supabase.functions.invoke("public-boleto-links", {
        body: {
          action: "log_download",
          cpf: cpfDigits,
          driveUrl: params.driveUrl,
          referenceMonth: params.referenceMonth || null,
          studentName: params.studentName || null,
        },
      });
    } catch {
      // best effort
    }
  };

  const handleDownloadClick = async (
    e: MouseEvent<HTMLAnchorElement>,
    params: {
      driveUrl: string;
      referenceMonth?: string | null;
      studentName?: string | null;
    },
  ) => {
    e.preventDefault();
    await logDownload(params);
    window.open(params.driveUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyDigitableLine = async (line: string | null | undefined) => {
    const value = String(line || "").trim();
    if (!value) {
      toast.error("Código de barras indisponível para este boleto.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Código de barras copiado.");
    } catch {
      toast.error("Não foi possível copiar o código de barras.");
    }
  };

  const handleSearchBills = async () => {
    if (!canSearch) {
      toast.error("Informe um CPF v?lido.");
      return;
    }

    setIsLoading(true);
    setItems([]);
    try {
      const { data, error } = await supabase.functions.invoke(
        "public-boleto-links",
        {
          body: {
            action: "list_bills",
            cpf: cpfDigits,
          },
        },
      );

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na consulta");

      const foundItems = sortBills((data.items || []) as PublicBoletoItem[]);
      setItems(foundItems);
      if (foundItems.length === 0) {
        toast.warning("Nenhum boleto encontrado para o CPF informado.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao buscar boletos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-white p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-white/90 backdrop-blur-sm shadow-sm p-6 md:p-8 text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            2ª via de boletos
          </h1>
          <p className="text-sm md:text-base text-slate-600">
            Consulte seus boletos rapidamente com o seu CPF.
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Consultar boletos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {welcomeName ? (
              <p className="text-sm font-medium text-primary">
                Bem-vindo, {welcomeName}
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={cpf}
                  onChange={(e) => {
                    setCpf(formatCpfMask(e.target.value));
                    setItems([]);
                  }}
                  placeholder="000.000.000-00"
                  disabled={isLoading}
                  className="w-full md:max-w-sm"
                />
              </div>

              <Button
                onClick={handleSearchBills}
                disabled={!canSearch || isLoading}
                className="w-full md:w-auto md:min-w-[190px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando boletos...
                  </>
                ) : (
                  "Buscar boletos"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-900">
              Antes de pagar, confira atentamente os dados do boleto para evitar
              equívocos: <strong>nome do pagador</strong>, <strong>CPF</strong>,{" "}
              <strong>data de vencimento</strong> e <strong>valor</strong>.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Boletos disponíveis</CardTitle>
            <Badge variant="secondary">{items.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ordenado do mais recente para o mais antigo.
              </p>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((k) => (
                  <div
                    key={k}
                    className="rounded-xl border bg-white p-3 md:p-4 animate-pulse"
                  >
                    <div className="h-5 w-36 rounded bg-slate-200" />
                    <div className="mt-3 flex gap-2">
                      <div className="h-4 w-28 rounded bg-slate-200" />
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </div>
                    <div className="mt-3 h-7 w-full rounded bg-slate-200" />
                    <div className="mt-3 flex gap-2">
                      <div className="h-8 w-24 rounded bg-slate-200" />
                      <div className="h-8 w-20 rounded bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
                Nenhum boleto para exibir.
              </p>
            ) : (
              <>
                <div className="hidden md:block rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-center">Valor</TableHead>
                        <TableHead className="text-center">A??es</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const statusBadge = getPublicStatusBadge(
                          item.public_status,
                        );
                        const StatusIcon = statusBadge.Icon;
                        return (
                          <Fragment
                            key={`${item.reference_month}-${item.our_number || idx}`}
                          >
                            <TableRow className="border-b-0">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {formatMonth(item.reference_month)}
                                  </span>
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium gap-1",
                                      statusBadge.className,
                                    )}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {statusBadge.label}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatDateBR(item.due_date)}
                              </TableCell>
                              <TableCell className="font-semibold text-center">
                                {formatCurrency(item.amount_cents)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="inline-flex items-center justify-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => {
                                      const preview = getDrivePreviewUrl(
                                        item.drive_url,
                                      );
                                      if (!preview) {
                                        toast.error(
                                          "Link do Google Drive inv?lido para pr?-visualiza??o.",
                                        );
                                        return;
                                      }
                                      setPreviewUrl(preview);
                                      setPreviewDownloadUrl(item.drive_url);
                                      setPreviewReferenceMonth(
                                        item.reference_month,
                                      );
                                      setPreviewStudentName(
                                        item.student_name || "Aluno",
                                      );
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <a
                                    href={item.drive_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) =>
                                      handleDownloadClick(e, {
                                        driveUrl: item.drive_url,
                                        referenceMonth: item.reference_month,
                                        studentName:
                                          item.student_name || "Aluno",
                                      })
                                    }
                                  >
                                    <Button size="icon">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </a>
                                </div>
                              </TableCell>
                            </TableRow>
                            <TableRow className="bg-slate-50/60">
                              <TableCell colSpan={4} className="pt-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {canShowDigitableLine(item.public_status) ? (
                                    <>
                                      <span
                                        className="text-[11px] font-mono rounded-md border bg-white px-2 py-1 text-slate-700 break-all cursor-copy"
                                        onClick={() =>
                                          handleCopyDigitableLine(
                                            item.digitable_line,
                                          )
                                        }
                                        title="Clique para copiar"
                                      >
                                        {item.digitable_line ||
                                          "Código de barras indispon?vel"}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5"
                                        onClick={() =>
                                          handleCopyDigitableLine(
                                            item.digitable_line,
                                          )
                                        }
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copiar código de barras
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {items.map((item, idx) => {
                    const statusBadge = getPublicStatusBadge(
                      item.public_status,
                    );
                    const StatusIcon = statusBadge.Icon;
                    return (
                      <div
                        key={`${item.reference_month}-${item.our_number || idx}`}
                        className="rounded-xl border bg-white p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-lg">
                              {formatMonth(item.reference_month)}
                            </p>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium gap-1",
                                statusBadge.className,
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusBadge.label}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Vencimento
                            </p>
                            <p className="font-medium">
                              {formatDateBR(item.due_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Valor
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(item.amount_cents)}
                            </p>
                          </div>
                        </div>
                        <div className="pt-1 space-y-2.5">
                          {canShowDigitableLine(item.public_status) ? (
                            <>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Código de barras
                              </p>
                              <span
                                className="text-[11px] font-mono rounded-md border bg-slate-50 px-2 py-2 text-slate-700 break-all block cursor-copy"
                                onClick={() =>
                                  handleCopyDigitableLine(item.digitable_line)
                                }
                                title="Clique para copiar"
                              >
                                {item.digitable_line ||
                                  "C?digo de barras indispon?vel"}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 w-full h-11"
                                onClick={() =>
                                  handleCopyDigitableLine(item.digitable_line)
                                }
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar código de barras
                              </Button>
                            </>
                          ) : null}

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-11"
                              onClick={() => {
                                const preview = getDrivePreviewUrl(
                                  item.drive_url,
                                );
                                if (!preview) {
                                  toast.error(
                                    "Link do Google Drive inv?lido para pr?-visualiza??o.",
                                  );
                                  return;
                                }
                                setPreviewUrl(preview);
                                setPreviewDownloadUrl(item.drive_url);
                                setPreviewReferenceMonth(item.reference_month);
                                setPreviewStudentName(
                                  item.student_name || "Aluno",
                                );
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              Visualizar
                            </Button>
                            <a
                              href={item.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) =>
                                handleDownloadClick(e, {
                                  driveUrl: item.drive_url,
                                  referenceMonth: item.reference_month,
                                  studentName: item.student_name || "Aluno",
                                })
                              }
                            >
                              <Button size="sm" className="gap-1.5 w-full h-11">
                                <Download className="h-4 w-4" />
                                Baixar boleto
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-700">
              Solicitações de alteração de boleto e outras questões, contatar
              aqui:{" "}
              <a
                href="https://wa.me/5517981606721"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
              >
                WhatsApp
              </a>
            </p>
          </CardContent>
        </Card>

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
              <DialogTitle className="m-0">
                Pr?-visualiza??o do boleto
              </DialogTitle>
              {previewDownloadUrl && (
                <a
                  href={previewDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                  onClick={(e) =>
                    handleDownloadClick(e, {
                      driveUrl: previewDownloadUrl,
                      referenceMonth: previewReferenceMonth,
                      studentName: previewStudentName,
                    })
                  }
                >
                  <Button size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                </a>
              )}
            </div>
            {previewUrl && (
              <div className="flex-1 min-h-0 bg-slate-100">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Pr?-visualiza??o do boleto"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
