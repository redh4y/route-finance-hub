import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Globe, Settings2, ExternalLink, Database } from "lucide-react";

export default function Settings() {
  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">
          Gerencie os dados que refletem na página pública <code>/site</code> e salvam direto no banco.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Landing Page (/site)
            </CardTitle>
            <CardDescription>
              Edita seções da landing (hero, serviços, frota, diferenciais, depoimentos, contato, SEO e CTA final).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/landing-settings">
              <Button>
                <Settings2 className="h-4 w-4 mr-2" />
                Abrir editor
              </Button>
            </Link>
            <a href="/site" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visualizar site
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Conteúdo Público Estruturado
            </CardTitle>
            <CardDescription>
              Edita textos, CTAs, imagens e seções dinâmicas da página pública por estrutura de conteúdo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/configuracoes/publico">
              <Button>
                <Settings2 className="h-4 w-4 mr-2" />
                Abrir editor
              </Button>
            </Link>
            <a href="/public/excursoes" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visualizar página
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

