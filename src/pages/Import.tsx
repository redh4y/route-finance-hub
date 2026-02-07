import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, mapBillingStatus } from "@/components/ui/status-badge";
import { PageTransition } from "@/components/ui/page-transition";
import { useImportPayers, useImportBillings, useImportCEPs } from "@/hooks/useImport";
import { formatCPF, formatCurrency, formatMonthRef } from "@/lib/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FileText, 
  Users, 
  MapPin, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Eye,
  X,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
            <ImportCard
              title="Importar Faturas"
              description="Importe faturas de cartão para lançamentos financeiros"
              icon={CreditCard}
              fields={[
                "Data", "Descrição", "Categoria", "Valor", "Parcelas"
              ]}
              onImport={() => toast.info("Funcionalidade de importação de faturas será implementada em breve")}
              disabled
            />
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
  const [showPreview, setShowPreview] = useState(false);
  const { importPayers, isImporting, progress, preview, parseFile, reset } = useImportPayers();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      await parseFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await parseFile(selectedFile);
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
          {/* Drop zone */}
          <motion.div
            animate={{ scale: isDragging ? 1.02 : 1 }}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-success bg-success/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
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
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {preview.length} registros
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
                  <p className="font-medium">Arraste um arquivo CSV aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Progress bar */}
          {isImporting && (
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
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {file && preview.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(true)}
                disabled={isImporting}
              >
                <Eye className="h-4 w-4 mr-2" />
                Visualizar ({preview.length})
              </Button>
            )}
            {file && (
              <Button 
                variant="ghost" 
                onClick={handleClear}
                disabled={isImporting}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button 
              onClick={handleImport} 
              disabled={!file || isImporting}
              className="ml-auto"
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

      {/* Fields info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos Esperados</CardTitle>
          <CardDescription>
            O arquivo CSV deve conter os seguintes campos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["Nome", "Identif (CPF)", "Cod Pagador", "Endereco", "CEP", "Cidade", "UF", "Telefone", "Email"].map((field, index) => (
              <div
                key={field}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-medium text-accent">
                  {index + 1}
                </span>
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning">Atenção</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A importação é idempotente. Registros existentes serão atualizados,
                  novos serão criados.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview - Pagadores</DialogTitle>
            <DialogDescription>
              {preview.length} registros serão importados
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 100).map((payer, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{payer?.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {payer?.document_digits ? formatCPF(payer.document_digits) : "-"}
                    </TableCell>
                    <TableCell>{payer?.payer_code || "-"}</TableCell>
                    <TableCell>{"city" in payer ? payer.city : "-"}</TableCell>
                    <TableCell>
                      {payer?.match_ok ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 100 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Mostrando 100 de {preview.length} registros
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportBillingsCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { importBillings, isImporting, progress, preview, parseFile, reset } = useImportBillings();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      await parseFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await parseFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    await importBillings(file);
    setFile(null);
    reset();
  };

  const handleClear = () => {
    setFile(null);
    reset();
  };

  // Calculate status summary
  const statusSummary = {
    PAID: preview.filter(b => b?.status === "PAID").length,
    OPEN: preview.filter(b => b?.status === "OPEN").length,
    CANCELADO: preview.filter(b => b?.status === "CANCELADO").length,
    NEEDS_REVIEW: preview.filter(b => b?.status === "NEEDS_REVIEW").length,
  };

  return (
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
          {/* Drop zone */}
          <motion.div
            animate={{ scale: isDragging ? 1.02 : 1 }}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-success bg-success/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
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
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {preview.length} boletos
                  </p>
                  {/* Status summary */}
                  {preview.length > 0 && (
                    <div className="flex justify-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        {statusSummary.PAID} pagos
                      </Badge>
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        {statusSummary.OPEN} abertos
                      </Badge>
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        {statusSummary.CANCELADO} cancelados
                      </Badge>
                    </div>
                  )}
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
                  <p className="font-medium">Arraste um arquivo CSV aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Progress bar */}
          {isImporting && (
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
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {file && preview.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(true)}
                disabled={isImporting}
              >
                <Eye className="h-4 w-4 mr-2" />
                Visualizar ({preview.length})
              </Button>
            )}
            {file && (
              <Button 
                variant="ghost" 
                onClick={handleClear}
                disabled={isImporting}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
            <Button 
              onClick={handleImport} 
              disabled={!file || isImporting}
              className="ml-auto"
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

      {/* Fields info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos Esperados</CardTitle>
          <CardDescription>
            O arquivo CSV deve conter os seguintes campos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["Nosso Numero", "Seu Numero", "Cod Pagador", "Data Vencimento", "Valor", "Data Baixa", "Data Pagamento"].map((field, index) => (
              <div
                key={field}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
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

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview - Boletos</DialogTitle>
            <DialogDescription>
              {preview.length} boletos serão importados
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Pagador</TableHead>
                  <TableHead>Mês Ref.</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 100).map((billing, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{billing?.payer_code}</TableCell>
                    <TableCell>{billing?.reference_month ? formatMonthRef(billing.reference_month) : "-"}</TableCell>
                    <TableCell>
                      {billing?.due_date 
                        ? new Date(billing.due_date).toLocaleDateString("pt-BR")
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(billing?.amount_expected_cents || 0)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={mapBillingStatus(billing?.status || "OPEN")} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.length > 100 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Mostrando 100 de {preview.length} registros
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportCEPsCard() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { importCEPs, isImporting, progress, reset } = useImportCEPs();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo CSV");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          <motion.div
            animate={{ scale: isDragging ? 1.02 : 1 }}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-success bg-success/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
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
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
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
                  <p className="font-medium">Arraste um arquivo CSV aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {isImporting && (
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
          )}

          <Button 
            onClick={handleImport} 
            disabled={!file || isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Importar CEPs
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos Esperados</CardTitle>
          <CardDescription>
            O arquivo CSV deve conter os seguintes campos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["CEP", "Logradouro", "Bairro", "Cidade", "UF"].map((field, index) => (
              <div
                key={field}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-medium text-accent">
                  {index + 1}
                </span>
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ImportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  fields: string[];
  onImport: () => void;
  disabled?: boolean;
}

function ImportCard({ title, description, icon: Icon, fields, onImport, disabled }: ImportCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className={disabled ? "opacity-60" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
            {disabled && <Badge variant="secondary">Em breve</Badge>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-success bg-success/5"
                : "border-border hover:border-muted-foreground/50"
            } ${disabled ? "pointer-events-none" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={disabled}
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="font-medium">Arraste um arquivo CSV aqui</p>
                <p className="text-sm text-muted-foreground">
                  ou clique para selecionar
                </p>
              </div>
            )}
          </div>

          <Button 
            onClick={onImport} 
            disabled={!file || disabled}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Arquivo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campos Esperados</CardTitle>
          <CardDescription>
            O arquivo CSV deve conter os seguintes campos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-xs font-medium text-accent">
                  {index + 1}
                </span>
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning">Atenção</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A importação é idempotente. Registros existentes serão atualizados,
                  novos serão criados.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
