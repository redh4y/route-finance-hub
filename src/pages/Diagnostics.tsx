import { MainLayout } from "@/components/layout/MainLayout";
import { useDiagnostics } from "@/contexts/DiagnosticsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Copy, Download } from "lucide-react";
import { toast } from "sonner";

function levelVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "error") return "destructive";
  if (level === "warn") return "secondary";
  return "outline";
}

export default function Diagnostics() {
  const { entries, clear } = useDiagnostics();

  const copyToClipboard = async () => {
    const payload = JSON.stringify(entries, null, 2);
    await navigator.clipboard.writeText(payload);
    toast.success("Logs copiados para a área de transferência");
  };

  const downloadJson = () => {
    const payload = JSON.stringify(entries, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostico-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Diagnóstico</h1>
        <p className="page-subtitle">
          Captura erros/warnings do navegador e falhas de requisição (4xx/5xx) para facilitar suporte.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Logs recentes</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={entries.length === 0}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={downloadJson} disabled={entries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Baixar JSON
            </Button>
            <Button variant="destructive" size="sm" onClick={clear} disabled={entries.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log capturado ainda.</p>
          ) : (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-3">
                {entries
                  .slice()
                  .reverse()
                  .map((e) => (
                    <div key={e.id} className="rounded-lg border bg-card p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={levelVariant(e.level)}>{e.level}</Badge>
                        <Badge variant="outline">{e.source}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(e.ts).toLocaleString()}</span>
                      </div>
                      <Separator className="my-2" />
                      <p className="text-sm font-medium break-words">{e.message}</p>
                      {e.details && <p className="mt-1 text-xs text-muted-foreground break-words">{e.details}</p>}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
