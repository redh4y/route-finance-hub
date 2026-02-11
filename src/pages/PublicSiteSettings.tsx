import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePublicSiteContent, useSavePublicSiteContent } from "@/hooks/usePublicSiteContent";
import { type PublicSiteContent } from "@/lib/publicSiteDefaults";
import { toast } from "sonner";

export default function PublicSiteSettings() {
  const { data, isLoading } = usePublicSiteContent();
  const saveMutation = useSavePublicSiteContent();
  const [form, setForm] = useState<PublicSiteContent | null>(null);
  const [servicesJson, setServicesJson] = useState("");
  const [fleetJson, setFleetJson] = useState("");
  const [differentialsJson, setDifferentialsJson] = useState("");
  const [testimonialsJson, setTestimonialsJson] = useState("");

  useEffect(() => {
    if (!data?.content) return;
    setForm(data.content);
    setServicesJson(JSON.stringify(data.content.services, null, 2));
    setFleetJson(JSON.stringify(data.content.fleet, null, 2));
    setDifferentialsJson(JSON.stringify(data.content.differentials, null, 2));
    setTestimonialsJson(JSON.stringify(data.content.testimonials, null, 2));
  }, [data]);

  const parseAndSave = () => {
    if (!form) return;
    try {
      const next: PublicSiteContent = {
        ...form,
        services: JSON.parse(servicesJson),
        fleet: JSON.parse(fleetJson),
        differentials: JSON.parse(differentialsJson),
        testimonials: JSON.parse(testimonialsJson),
      };
      saveMutation.mutate(next);
    } catch {
      toast.error("JSON invalido em uma das secoes (servicos, frota, diferenciais ou depoimentos).");
    }
  };

  if (isLoading || !form) {
    return (
      <MainLayout>
        <div className="py-12 text-center text-muted-foreground">Carregando configuracoes...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Configuracoes da pagina publica</h1>
        <p className="page-subtitle">Edite textos, imagens e secoes da landing de excursoes</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>SEO e contato</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Meta title</Label>
              <Input value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Meta description</Label>
              <Input value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Imagem OG (URL)</Label>
              <Input value={form.ogImageUrl} onChange={(e) => setForm({ ...form, ogImageUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Imagem Hero (URL)</Label>
              <Input value={form.heroImageUrl} onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp URL</Label>
              <Input value={form.whatsappUrl} onChange={(e) => setForm({ ...form, whatsappUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Orcamento URL</Label>
              <Input value={form.budgetUrl} onChange={(e) => setForm({ ...form, budgetUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereco</Label>
              <Input value={form.contactAddress} onChange={(e) => setForm({ ...form, contactAddress: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hero</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Badge</Label>
              <Input value={form.heroBadge} onChange={(e) => setForm({ ...form, heroBadge: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Titulo principal</Label>
              <Input value={form.heroTitle} onChange={(e) => setForm({ ...form, heroTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subtitulo</Label>
              <Textarea value={form.heroSubtitle} onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CTA primario</Label>
                <Input value={form.heroPrimaryCta} onChange={(e) => setForm({ ...form, heroPrimaryCta: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CTA secundario</Label>
                <Input value={form.heroSecondaryCta} onChange={(e) => setForm({ ...form, heroSecondaryCta: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Secoes ativas</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-4">
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label>Servicos</Label>
              <Switch checked={form.showServices} onCheckedChange={(v) => setForm({ ...form, showServices: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label>Frota</Label>
              <Switch checked={form.showFleet} onCheckedChange={(v) => setForm({ ...form, showFleet: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label>Diferenciais</Label>
              <Switch checked={form.showDifferentials} onCheckedChange={(v) => setForm({ ...form, showDifferentials: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label>Confianca</Label>
              <Switch checked={form.showTrust} onCheckedChange={(v) => setForm({ ...form, showTrust: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <Label>CTA final</Label>
              <Switch checked={form.showFinalCta} onCheckedChange={(v) => setForm({ ...form, showFinalCta: v })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Estruturas editaveis (JSON)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Servicos</Label>
              <Textarea value={servicesJson} onChange={(e) => setServicesJson(e.target.value)} className="font-mono min-h-[140px]" />
            </div>
            <div className="space-y-2">
              <Label>Frota</Label>
              <Textarea value={fleetJson} onChange={(e) => setFleetJson(e.target.value)} className="font-mono min-h-[140px]" />
            </div>
            <div className="space-y-2">
              <Label>Diferenciais</Label>
              <Textarea value={differentialsJson} onChange={(e) => setDifferentialsJson(e.target.value)} className="font-mono min-h-[120px]" />
            </div>
            <div className="space-y-2">
              <Label>Depoimentos</Label>
              <Textarea value={testimonialsJson} onChange={(e) => setTestimonialsJson(e.target.value)} className="font-mono min-h-[140px]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Indicadores e CTA final</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Anos</Label>
                <Input value={form.trustYears} onChange={(e) => setForm({ ...form, trustYears: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Clientes</Label>
                <Input value={form.trustClients} onChange={(e) => setForm({ ...form, trustClients: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Viagens</Label>
                <Input value={form.trustTrips} onChange={(e) => setForm({ ...form, trustTrips: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titulo CTA final</Label>
              <Textarea value={form.finalCtaTitle} onChange={(e) => setForm({ ...form, finalCtaTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subtitulo CTA final</Label>
              <Textarea value={form.finalCtaSubtitle} onChange={(e) => setForm({ ...form, finalCtaSubtitle: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={parseAndSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar configuracoes"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

