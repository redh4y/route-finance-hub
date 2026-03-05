import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function toDigits(input: string) {
  return input.replace(/\D/g, "");
}

export default function WhatsappPage() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: activeProvider } = useQuery({
    queryKey: ["whatsapp-provider-active-page"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_providers")
        .select("id, name, instance_name, active")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; instance_name: string; active: boolean } | null;
    },
  });

  const handleSendTest = async () => {
    const digits = toDigits(phone);
    if (!digits) {
      toast.error("Informe um numero de WhatsApp.");
      return;
    }
    if (!message.trim()) {
      toast.error("Informe a mensagem de teste.");
      return;
    }

    setIsSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
        body: {
          action: "send_test",
          phone: digits,
          message: message.trim(),
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha no envio");

      setLastResult({ ok: true, message: "Mensagem enviada com sucesso." });
      toast.success("Mensagem enviada.");
    } catch (error: any) {
      const msg = error?.message || "Falha ao enviar mensagem.";
      setLastResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-subtitle">Teste rapido de envio via Evolution API.</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Envio de teste
            </CardTitle>
            <CardDescription>
              Informe numero e mensagem para validar a integracao.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={activeProvider ? "secondary" : "outline"}>
                {activeProvider
                  ? `Provider ativo: ${activeProvider.name} (${activeProvider.instance_name})`
                  : "Sem provider ativo"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-phone">Numero</Label>
              <Input
                id="wa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5517999999999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-message">Mensagem</Label>
              <Textarea
                id="wa-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensagem de teste do Tavares Finance"
                rows={6}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSendTest} disabled={isSending || !activeProvider}>
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar teste"
                )}
              </Button>
              {lastResult && (
                <Badge variant={lastResult.ok ? "secondary" : "outline"}>{lastResult.message}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </PageTransition>
    </MainLayout>
  );
}
