import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function toDigits(input: string) {
  return input.replace(/\D/g, "");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "-";
  return `+${digits}`;
}

export default function WhatsappPage() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["whatsapp-contacts", activeProvider?.id],
    enabled: !!activeProvider?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_contacts")
        .select("id, wa_number, display_name, updated_at")
        .eq("provider_id", activeProvider!.id)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        wa_number: string;
        display_name: string | null;
        updated_at: string;
      }>;
    },
  });

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((c) => {
      const name = String(c.display_name || "").toLowerCase();
      const number = String(c.wa_number || "").toLowerCase();
      return name.includes(term) || number.includes(term);
    });
  }, [contacts, search]);

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

  const handleSyncContacts = async () => {
    if (!activeProvider?.id) {
      toast.error("Ative um provider antes de sincronizar contatos.");
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
        body: {
          action: "sync_contacts",
          providerId: activeProvider.id,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao sincronizar contatos");

      await queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts", activeProvider.id] });
      toast.success(`Contatos sincronizados: ${data?.total ?? 0}.`);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao sincronizar contatos.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-subtitle">Teste de envio e sincronizacao de contatos via Evolution API.</p>
        </div>

        <div className="space-y-6 max-w-4xl">
          <Card>
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
                  rows={5}
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contatos da instancia
              </CardTitle>
              <CardDescription>
                Atualize a lista e use o cache local salvo no Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSyncContacts} disabled={isSyncing || !activeProvider}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar lista de contatos
                    </>
                  )}
                </Button>
                <Badge variant="outline">Total: {contacts.length}</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wa-search">Buscar contato</Label>
                <Input
                  id="wa-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome ou numero"
                />
              </div>

              {!activeProvider ? (
                <p className="text-sm text-muted-foreground">Ative um provider para listar contatos.</p>
              ) : contactsLoading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando contatos...
                </div>
              ) : filteredContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contato encontrado.</p>
              ) : (
                <div className="rounded-md border max-h-[420px] overflow-auto">
                  {filteredContacts.map((contact) => (
                    <div key={contact.id} className="px-3 py-2 border-b last:border-b-0">
                      <p className="text-sm font-medium">{contact.display_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{formatPhone(contact.wa_number)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
