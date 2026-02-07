import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/ui/page-transition";
import { useOptimizedImportPayers, useOptimizedImportBillings, useOptimizedImportCEPs } from "@/hooks/useOptimizedImport";
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
  X,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";

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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Importar Faturas
                </CardTitle>
                <CardDescription>
                  Importe faturas de cartão para lançamentos financeiros
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Funcionalidade em desenvolvimento</p>
                </div>
              </CardContent>
            </Card>
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
  const { importBillings, isImporting, progress, reset } = useOptimizedImportBillings();

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
    await importBillings(file);
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
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: {
  file: File | null;
  isDragging: boolean;
  isImporting: boolean;
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
        accept=".csv"
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
            <p className="font-medium">Arraste um arquivo CSV aqui</p>
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
