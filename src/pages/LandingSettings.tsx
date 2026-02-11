import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLandingSettings, useUpdateLandingSetting } from "@/hooks/useLandingSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Eye, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const sectionLabels: Record<string, string> = {
  hero: "Hero Principal",
  services: "Serviços",
  fleet: "Frota",
  differentials: "Diferenciais",
  testimonials: "Depoimentos",
  trust_indicators: "Indicadores",
  university: "Transporte Universitário",
  contact: "Contato",
  seo: "SEO",
  cta_final: "CTA Final",
};

export default function LandingSettings() {
  const { data: settings, isLoading } = useLandingSettings();
  const updateSetting = useUpdateLandingSetting();
  const navigate = useNavigate();
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  const handleSave = async (section: string) => {
    try {
      const raw = editedContent[section];
      if (!raw) return;
      const content = JSON.parse(raw);
      await updateSetting.mutateAsync({ section, content });
      toast.success(`Seção "${sectionLabels[section]}" atualizada!`);
      setEditedContent((prev) => {
        const n = { ...prev };
        delete n[section];
        return n;
      });
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        toast.error("JSON inválido. Verifique a formatação.");
      } else {
        toast.error(`Erro: ${e.message}`);
      }
    }
  };

  const toggleSection = async (section: string, enabled: boolean) => {
    await updateSetting.mutateAsync({ section, enabled });
    toast.success(`Seção "${sectionLabels[section]}" ${enabled ? "ativada" : "desativada"}`);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  const sections = Object.keys(sectionLabels);

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title">Landing Page</h1>
            <p className="page-subtitle">Gerencie o conteúdo da página pública</p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/site")}
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="hero" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          {sections.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs sm:text-sm">
              {sectionLabels[s]}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map((section) => {
          const setting = settings?.[section];
          const currentJson = editedContent[section] ?? JSON.stringify(setting?.content || {}, null, 2);

          return (
            <TabsContent key={section} value={section}>
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{sectionLabels[section]}</CardTitle>
                    {section !== "contact" && section !== "seo" && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`toggle-${section}`} className="text-sm text-muted-foreground">
                          {setting?.enabled ? "Ativa" : "Desativada"}
                        </Label>
                        <Switch
                          id={`toggle-${section}`}
                          checked={setting?.enabled ?? true}
                          onCheckedChange={(checked) => toggleSection(section, checked)}
                        />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Conteúdo (JSON)
                    </Label>
                    <Textarea
                      value={currentJson}
                      onChange={(e) => setEditedContent((prev) => ({ ...prev, [section]: e.target.value }))}
                      className="font-mono text-xs min-h-[300px]"
                      spellCheck={false}
                    />
                  </div>
                  <Button
                    onClick={() => handleSave(section)}
                    disabled={!editedContent[section] || updateSetting.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </MainLayout>
  );
}
