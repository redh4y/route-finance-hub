import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, Eye, FileText, Loader2 } from "lucide-react";

type PublicBoletoItem = {
  reference_month: string;
  student_name: string;
  drive_url: string;
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
  if (byFilePath?.[1])
    return `https://drive.google.com/file/d/${byFilePath[1]}/preview`;

  const byIdQuery = direct.match(/[?&]id=([^&]+)/i);
  if (byIdQuery?.[1])
    return `https://drive.google.com/file/d/${byIdQuery[1]}/preview`;

  return null;
}

function formatMonth(ref: string) {
  if (!ref || !/^\d{4}-\d{2}$/.test(ref)) return ref;
  const [y, m] = ref.split("-");
  return `${m}/${y}`;
}

export default function PublicBoletoLinksPage() {
  const [cpf, setCpf] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PublicBoletoItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(
    null,
  );

  const cpfDigits = useMemo(() => onlyDigits(cpf), [cpf]);
  const canSearch = cpfDigits.length === 11;

  const handleSearchBills = async () => {
    if (!canSearch) {
      toast.error("Informe um CPF valido.");
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

      const foundItems = (data.items || []) as PublicBoletoItem[];
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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Boletos disponíveis</CardTitle>
            <Badge variant="secondary">{items.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="rounded-lg border p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando seus boletos...
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
                Nenhum boleto para exibir.
              </p>
            ) : (
              items.map((item, idx) => (
                <div
                  key={`${item.reference_month}-${idx}`}
                  className="rounded-xl border bg-white p-3 md:p-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between hover:shadow-sm transition-shadow"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {item.student_name || "Aluno"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {formatMonth(item.reference_month)}
                      </Badge>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Boleto
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 w-full sm:w-auto"
                      onClick={() => {
                        const preview = getDrivePreviewUrl(item.drive_url);
                        if (!preview) {
                          toast.error(
                            "Link do Google Drive invalido para pre-visualizacao.",
                          );
                          return;
                        }
                        setPreviewUrl(preview);
                        setPreviewDownloadUrl(item.drive_url);
                      }}
                    >
                      <Eye className="h-4 w-4" /> Visualizar
                    </Button>
                    <a href={item.drive_url} target="_blank" rel="noreferrer">
                      <Button size="sm" className="gap-1.5 w-full sm:w-auto">
                        <Download className="h-4 w-4" /> Baixar
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!previewUrl}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewUrl(null);
              setPreviewDownloadUrl(null);
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-6xl h-[95vh] !p-0 !gap-0 !flex !flex-col min-h-0 overflow-hidden [&>button]:right-2 [&>button]:top-2">
            <div className="w-full shrink-0 border-b px-4 py-3 pr-10 flex items-center justify-between gap-3">
              <DialogTitle className="m-0">
                Pre-visualizacao do boleto
              </DialogTitle>
              {previewDownloadUrl && (
                <a
                  href={previewDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
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
                  title="Pre-visualizacao do boleto"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
