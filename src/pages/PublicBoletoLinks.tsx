import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Loader2 } from "lucide-react";

type PublicBoletoItem = {
  reference_month: string;
  student_name: string;
  drive_url: string;
};

function onlyDigits(input: string) {
  return input.replace(/\D/g, "");
}

function formatMonth(ref: string) {
  if (!ref || !/^\d{4}-\d{2}$/.test(ref)) return ref;
  const [y, m] = ref.split("-");
  return `${m}/${y}`;
}

export default function PublicBoletoLinksPage() {
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PublicBoletoItem[]>([]);

  const canSearch = useMemo(() => onlyDigits(cpf).length === 11 && onlyDigits(phone).length >= 10, [cpf, phone]);

  const handleSearch = async () => {
    if (!canSearch) {
      toast.error("Informe CPF e WhatsApp validos.");
      return;
    }

    setIsLoading(true);
    setItems([]);
    try {
      const { data, error } = await supabase.functions.invoke("public-boleto-links", {
        body: {
          cpf: onlyDigits(cpf),
          phone: onlyDigits(phone),
          referenceMonth: referenceMonth || null,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na consulta");

      setItems((data.items || []) as PublicBoletoItem[]);
      if ((data.items || []).length === 0) {
        toast.warning("Nenhum boleto encontrado para os dados informados.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Erro ao buscar boletos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">2a via de boletos</h1>
          <p className="text-sm text-slate-600">Acesse seus links com WhatsApp + CPF.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consultar boletos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Competencia (opcional)</Label>
              <Input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} />
            </div>

            <Button onClick={handleSearch} disabled={isLoading || !canSearch} className="w-full md:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Consultando...
                </>
              ) : (
                "Buscar boletos"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Boletos disponiveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum boleto para exibir.</p>
            ) : (
              items.map((item, idx) => (
                <div key={`${item.reference_month}-${idx}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{item.student_name || "Aluno"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{formatMonth(item.reference_month)}</Badge>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Boleto
                      </span>
                    </div>
                  </div>
                  <a href={item.drive_url} target="_blank" rel="noreferrer">
                    <Button size="sm" className="gap-1.5">
                      <Download className="h-4 w-4" /> Baixar
                    </Button>
                  </a>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
