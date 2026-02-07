import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Users, MapPin, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Import() {
  const [activeTab, setActiveTab] = useState("pagadores");

  return (
    <MainLayout>
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
          <ImportCard
            title="Importar Pagadores"
            description="Importe a lista de alunos/pagadores a partir de um arquivo CSV"
            icon={Users}
            fields={[
              "Nome", "Identif (CPF)", "Cod Pagador", "Endereco", "CEP", 
              "Cidade", "UF", "Telefone", "Email"
            ]}
            onImport={() => toast.info("Funcionalidade de importação será implementada")}
          />
        </TabsContent>

        <TabsContent value="boletos">
          <ImportCard
            title="Importar Boletos"
            description="Importe boletos bancários e atualize status de pagamento"
            icon={FileText}
            fields={[
              "Nosso Número", "Seu Número", "Cod Pagador", "Data Vencimento",
              "Valor", "Data Baixa", "Data Pagamento"
            ]}
            onImport={() => toast.info("Funcionalidade de importação será implementada")}
          />
        </TabsContent>

        <TabsContent value="faturas">
          <ImportCard
            title="Importar Faturas"
            description="Importe faturas de cartão para lançamentos financeiros"
            icon={CreditCard}
            fields={[
              "Data", "Descrição", "Categoria", "Valor", "Parcelas"
            ]}
            onImport={() => toast.info("Funcionalidade de importação será implementada")}
          />
        </TabsContent>

        <TabsContent value="ceps">
          <ImportCard
            title="Importar CEPs"
            description="Importe base de CEPs para lookup de endereços"
            icon={MapPin}
            fields={[
              "CEP", "Logradouro", "Bairro", "Cidade", "UF"
            ]}
            onImport={() => toast.info("Funcionalidade de importação será implementada")}
          />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}

interface ImportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  fields: string[];
  onImport: () => void;
}

function ImportCard({ title, description, icon: Icon, fields, onImport }: ImportCardProps) {
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop zone */}
          <div
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
            disabled={!file}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Arquivo
          </Button>
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
