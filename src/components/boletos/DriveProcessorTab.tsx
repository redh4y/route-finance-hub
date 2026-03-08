import { useState, useMemo } from "react";
import {
  useDriveProcessor,
  findExactDuplicates,
  findPossibleReissues,
  type BoletoResult,
} from "@/hooks/useDriveProcessor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HardDrive,
  Play,
  Square,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  FolderOpen,
  Key,
  Settings2,
  FileText,
  Loader2,
  LogOut,
  LogIn,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export function DriveProcessorTab() {
  const {
    credentialsJson,
    updateCredentialsJson,
    credentials,
    oauthStatus,
    connectedEmail,
    startOAuth,
    disconnect,
    folderId,
    setFolderId,
    flags,
    setFlags,
    isProcessing,
    progress,
    results,
    folderName,
    processFiles,
    abort,
    deleteDuplicateFiles,
  } = useDriveProcessor();

  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDebug, setShowDebug] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = results.length;
    const ok = results.filter((r) => r.success).length;
    const fail = total - ok;
    const skipped = results.filter(
      (r) => r.error === "SKIPPED_ALREADY_RENAMED"
    ).length;
    return { total, ok, fail, skipped };
  }, [results]);

  const exactDupes = useMemo(() => findExactDuplicates(results), [results]);
  const possibleReissues = useMemo(
    () => findPossibleReissues(results),
    [results]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return results;
    return results.filter(
      (r) =>
        (r.payer_name || "").toLowerCase().includes(q) ||
        (r.payer_cpf || "").includes(q) ||
        (r.original_file_name || "").toLowerCase().includes(q) ||
        (r.our_number || "").includes(q)
    );
  }, [results, search]);

  const handleProcess = async () => {
    if (oauthStatus !== "connected") {
      toast.error("Conecte ao Google Drive primeiro");
      return;
    }
    if (!folderId.trim()) {
      toast.error("Informe o Folder ID");
      return;
    }
    try {
      await processFiles();
      toast.success("Processamento concluído");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleDeleteDupes = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      const idsToDelete: string[] = [];
      for (const group of exactDupes) {
        for (const item of group.items.slice(1)) {
          if (item.file_id) idsToDelete.push(item.file_id);
        }
      }
      if (!idsToDelete.length) {
        toast.info("Nenhum arquivo para excluir");
        return;
      }
      const { deleted, errors } = await deleteDuplicateFiles(idsToDelete);
      if (deleted.length) toast.success(`${deleted.length} arquivo(s) excluído(s)`);
      if (errors.length)
        toast.error(`Erros: ${errors.slice(0, 3).join("; ")}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const downloadJson = () => {
    const safeName =
      (folderName || "pasta_sem_nome")
        .replace(/[^A-Za-z0-9._\- ]/g, "_")
        .trim() || "pasta_sem_nome";
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `00_boletos_${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const isConnected = oauthStatus === "connected";

  return (
    <div className="space-y-6">
      {/* Auth & Config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Auth Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Autenticação Google Drive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Credentials JSON */}
            <div>
              <Label htmlFor="credentials-json" className="text-sm">
                Credenciais Google (JSON)
              </Label>
              <Textarea
                id="credentials-json"
                placeholder='Cole aqui o conteúdo do arquivo credentials.json do Google Cloud Console...'
                value={credentialsJson}
                onChange={(e) => updateCredentialsJson(e.target.value)}
                className="h-24 font-mono text-xs mt-1"
                disabled={isConnected}
              />
              {credentialsJson && !credentials && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  JSON inválido. Verifique o formato.
                </p>
              )}
              {credentials && !isConnected && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Credenciais reconhecidas: {credentials.client_id.slice(0, 20)}...
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Baixe o JSON em{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google Cloud Console → API Credentials
                </a>
                . Adicione{" "}
                <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                  {window.location.origin}/boletos-links
                </code>{" "}
                como URI de redirecionamento autorizado.
              </p>
            </div>

            {/* Connect / Status */}
            <div className="flex items-center gap-3">
              {!isConnected ? (
                <Button
                  onClick={startOAuth}
                  disabled={!credentials || oauthStatus === "connecting"}
                  className="gap-2"
                >
                  {oauthStatus === "connecting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {oauthStatus === "connecting"
                    ? "Conectando..."
                    : "Conectar ao Google Drive"}
                </Button>
              ) : (
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-medium">Conectado</span>
                    {connectedEmail && (
                      <span className="text-muted-foreground">
                        ({connectedEmail})
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnect}
                    className="gap-1.5 ml-auto"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Desconectar
                  </Button>
                </div>
              )}
            </div>

            {oauthStatus === "error" && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Erro na autenticação. Tente novamente.
              </p>
            )}

            {/* Folder ID */}
            <div>
              <Label htmlFor="folder-id" className="text-sm">
                Folder ID
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="folder-id"
                  placeholder="1AbCdEfGh..."
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="font-mono text-xs"
                />
                {folderId && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      window.open(
                        `https://drive.google.com/drive/folders/${folderId.trim()}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {folderName && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {folderName}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flags Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Configurações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: "rename_files" as const,
                label: "Renomear PDFs no Drive",
                desc: "Padrão: NOME - CPF.pdf",
              },
              {
                key: "skip_already_renamed" as const,
                label: "Pular já renomeados",
                desc: "Ignora 'NOME - 12345678901.pdf'",
              },
              {
                key: "debug_mode" as const,
                label: "Modo debug",
                desc: "Inclui texto extraído no JSON",
              },
              {
                key: "save_json_on_drive" as const,
                label: "Salvar JSON no Drive",
                desc: "Cria/atualiza 00_boletos_*.json na pasta",
              },
            ].map((flag) => (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">{flag.desc}</p>
                </div>
                <Switch
                  checked={flags[flag.key]}
                  onCheckedChange={(v) =>
                    setFlags((prev) => ({ ...prev, [flag.key]: v }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {!isProcessing ? (
          <Button onClick={handleProcess} disabled={!isConnected || !folderId}>
            <Play className="h-4 w-4 mr-2" />
            Processar Boletos
          </Button>
        ) : (
          <Button variant="destructive" onClick={abort}>
            <Square className="h-4 w-4 mr-2" />
            Parar
          </Button>
        )}

        {results.length > 0 && (
          <Button variant="outline" onClick={downloadJson}>
            <Download className="h-4 w-4 mr-2" />
            Baixar JSON
          </Button>
        )}

        {isProcessing && (
          <div className="flex-1 min-w-[200px] space-y-1">
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {progress.current}/{progress.total} arquivos ({progressPct}%)
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{stats.ok}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">
                  {stats.fail}
                </p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">
                  {stats.skipped}
                </p>
                <p className="text-xs text-muted-foreground">Pulados</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Resultados</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Pagador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nosso Nº</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                    <TableHead className="w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => (
                    <TableRow
                      key={r.file_id || i}
                      className={!r.success ? "bg-destructive/5" : undefined}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[160px] truncate">
                        {r.payer_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.payer_cpf
                          ? r.payer_cpf.replace(
                              /(\d{3})(\d{3})(\d{3})(\d{2})/,
                              "$1.$2.$3-$4"
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.our_number || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{r.amount || "—"}</TableCell>
                      <TableCell className="text-xs">{r.due_date || "—"}</TableCell>
                      <TableCell
                        className="text-xs max-w-[140px] truncate"
                        title={r.original_file_name}
                      >
                        {r.final_file_name || r.original_file_name}
                      </TableCell>
                      <TableCell>
                        {r.success ? (
                          r.error === "SKIPPED_ALREADY_RENAMED" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Pulado
                            </Badge>
                          ) : (
                            <Badge
                              variant="default"
                              className="bg-success/20 text-success text-[10px]"
                            >
                              OK
                            </Badge>
                          )
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.view_link && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                window.open(r.view_link, "_blank")
                              }
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {flags.debug_mode && r.debug_full_text && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setShowDebug(
                                  showDebug === r.file_id
                                    ? null
                                    : r.file_id
                                )
                              }
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Debug panel */}
      {showDebug && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Debug — Texto extraído</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md max-h-[300px] overflow-auto whitespace-pre-wrap">
              {results.find((r) => r.file_id === showDebug)?.debug_full_text ||
                "Sem dados debug"}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Duplicates */}
      {exactDupes.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Duplicados Exatos ({exactDupes.length} grupo(s))
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="single" collapsible>
              {exactDupes.map((group, gi) => (
                <AccordionItem key={gi} value={`dup-${gi}`}>
                  <AccordionTrigger className="text-sm">
                    Nosso Nº: {group.items[0]?.our_number} —{" "}
                    {group.items.length} arquivos
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1">
                      {group.items.map((item, ii) => (
                        <div
                          key={ii}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Badge
                            variant={ii === 0 ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {ii === 0 ? "Manter" : "Excluir"}
                          </Badge>
                          <span className="truncate">
                            {item.original_file_name}
                          </span>
                          {item.view_link && (
                            <a
                              href={item.view_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Switch
                checked={confirmDelete}
                onCheckedChange={setConfirmDelete}
              />
              <Label className="text-sm">
                Confirmo excluir duplicados e manter apenas 1 por grupo
              </Label>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={!confirmDelete || isDeleting}
              onClick={handleDeleteDupes}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {isDeleting ? "Excluindo..." : "Excluir Duplicados"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Possible Reissues */}
      {possibleReissues.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Possível Duplicidade/Reemissão ({possibleReissues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pagador</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Nosso(s) Nº</TableHead>
                  <TableHead>Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {possibleReissues.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.payer_name}</TableCell>
                    <TableCell className="text-xs">{r.due_date}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {r.our_numbers.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.our_numbers.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
