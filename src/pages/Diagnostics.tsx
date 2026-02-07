import { useState, MouseEvent } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useDiagnostics } from "@/contexts/DiagnosticsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Copy, Download, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function levelVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  if (level === "error") return "destructive";
  if (level === "warn") return "secondary";
  return "outline";
}

export default function Diagnostics() {
  const { entries, clear } = useDiagnostics();
  const [confirmText, setConfirmText] = useState("");
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [collection, setCollection] = useState("all");

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

  const clearDatabase = async () => {
    if (confirmText.trim().toUpperCase() !== "LIMPAR") {
      toast.error("Digite LIMPAR para confirmar");
      return;
    }

    setIsClearingDb(true);
    try {
      const steps = [
        { table: "financial_entries", filter: { column: "id", op: "is", value: null } },
        { table: "billings", filter: { column: "id", op: "is", value: null } },
        { table: "payers", filter: { column: "id", op: "is", value: null } },
        { table: "import_logs", filter: { column: "id", op: "is", value: null } },
        { table: "ceps", filter: { column: "cep", op: "is", value: null } },
      ];

      const targetSteps =
        collection === "all"
          ? steps
          : steps.filter((step) => step.table === collection);

      if (targetSteps.length === 0) {
        throw new Error("Coleção inválida");
      }

      for (const step of targetSteps) {
        const { error } = await supabase
          .from(step.table as any)
          .delete()
          .not(step.filter.column, step.filter.op as any, step.filter.value as any);

        if (error) {
          throw new Error(`${step.table}: ${error.message}`);
        }
      }

      toast.success(
        collection === "all"
          ? "Banco limpo com sucesso"
          : `Coleção ${collection} limpa com sucesso`
      );
      setConfirmText("");
    } catch (error: any) {
      toast.error(`Falha ao limpar banco: ${error.message}`);
    } finally {
      setIsClearingDb(false);
    }
  };

  const handleConfirmClear = async (e: MouseEvent<HTMLButtonElement>) => {
    if (confirmText.trim().toUpperCase() !== "LIMPAR") {
      e.preventDefault();
      toast.error("Digite LIMPAR para confirmar");
      return;
    }
    await clearDatabase();
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

      <Card className="mt-6 border-destructive/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base text-destructive">Zona perigosa</CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Limpar banco
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar dados do banco</AlertDialogTitle>
                <AlertDialogDescription>
                  Escolha a coleção que deseja limpar. A ação remove todos os registros
                  da coleção selecionada. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <div className="space-y-2">
                  <p className="text-sm">Coleção</p>
                  <Select value={collection} onValueChange={setCollection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as coleções</SelectItem>
                      <SelectItem value="payers">payers</SelectItem>
                      <SelectItem value="billings">billings</SelectItem>
                      <SelectItem value="financial_entries">financial_entries</SelectItem>
                      <SelectItem value="import_logs">import_logs</SelectItem>
                      <SelectItem value="ceps">ceps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm">
                  Digite <strong>LIMPAR</strong> para confirmar:
                </p>
                <Input
                  placeholder="LIMPAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isClearingDb}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isClearingDb}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmClear} disabled={isClearingDb}>
                  {isClearingDb ? "Limpando..." : "Confirmar limpeza"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use somente quando quiser zerar o ambiente. As permissões do usuário
            devem permitir deleção total dessas tabelas no Supabase.
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
