import { MainLayout } from "@/components/layout/MainLayout";
import { AdminGroupCard, AdminFeature, AdminIndicator, AdminAction } from "@/components/admin/AdminGroupCard";
import { useAdminStats } from "@/hooks/useAdminStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Upload,
  TrendingUp,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Bus,
  CreditCard,
  Truck,
  MapPin,
  Bug,
  Settings2,
  Users2,
  Shield,
  BarChart3,
} from "lucide-react";

interface GroupConfig {
  title: string;
  description: string;
  icon: typeof Users;
  iconColor: string;
  features: AdminFeature[];
  getIndicators: (s: ReturnType<typeof useAdminStats>["data"]) => AdminIndicator[];
  actions: AdminAction[];
}

const groups: GroupConfig[] = [
  {
    title: "Cobrança e Pagadores",
    description: "Gestão de pagadores, importação de boletos e acompanhamento de cobranças.",
    icon: Users,
    iconColor: "text-accent",
    features: [
      { label: "Pagadores", path: "/pagadores" },
      { label: "Importar Boletos", path: "/importar" },
      { label: "Atrasos", path: "/atrasos" },
    ],
    getIndicators: (s) => [
      { label: "pagadores", value: s?.payers.total ?? "—" },
      { label: "ativos", value: s?.payers.active ?? "—", variant: "success" },
      { label: "em aberto", value: s?.billings.open ?? "—", variant: "warning", tooltip: "Cobranças ainda não pagas no sistema" },
      { label: "pagos", value: s?.billings.paid ?? "—", variant: "success" },
    ],
    actions: [
      { label: "Ver pagadores", path: "/pagadores", icon: Users },
      { label: "Importar", path: "/importar", icon: Upload },
    ],
  },
  {
    title: "Financeiro e DRE",
    description: "Entradas, saídas, classificação de custos e relatórios financeiros consolidados.",
    icon: TrendingUp,
    iconColor: "text-success",
    features: [
      { label: "DRE", path: "/financeiro" },
      { label: "Entradas", path: "/financeiro/entradas" },
      { label: "Saídas", path: "/financeiro/saidas" },
      { label: "Relatórios", path: "/relatorios" },
    ],
    getIndicators: (s) => [
      { label: "receitas", value: s?.financialEntries.revenue ?? "—", variant: "success" },
      { label: "despesas", value: s?.financialEntries.expense ?? "—", variant: "destructive" },
    ],
    actions: [
      { label: "Entradas", path: "/financeiro/entradas", icon: ArrowUpCircle },
      { label: "Saídas", path: "/financeiro/saidas", icon: ArrowDownCircle },
      { label: "Relatórios", path: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    title: "Operação e Frota",
    description: "Rotas, veículos e indicadores operacionais da frota.",
    icon: Truck,
    iconColor: "text-warning",
    features: [
      { label: "Rotas", path: "/rotas" },
      { label: "Veículos", path: "/veiculos" },
    ],
    getIndicators: (s) => [
      { label: "veículos", value: s?.vehicles.total ?? "—" },
      { label: "ativos", value: s?.vehicles.active ?? "—", variant: "success" },
    ],
    actions: [
      { label: "Rotas", path: "/rotas", icon: MapPin },
      { label: "Veículos", path: "/veiculos", icon: Truck },
    ],
  },
  {
    title: "Excursões e Vendas",
    description: "Gerenciamento de excursões, checkout público, afiliados e leads capturados.",
    icon: Bus,
    iconColor: "text-primary",
    features: [
      { label: "Excursões", path: "/excursoes" },
      { label: "Afiliados", path: "/afiliados" },
      { label: "Leads", path: "/leads" },
    ],
    getIndicators: (s) => [
      { label: "excursões", value: s?.excursions.total ?? "—" },
      { label: "abertas", value: s?.excursions.open ?? "—", variant: "success" },
      { label: "publicadas", value: s?.excursions.published ?? "—", variant: "warning", tooltip: "Excursões visíveis no checkout público" },
      { label: "leads", value: s?.leads.total ?? "—" },
      { label: "afiliados", value: s?.affiliates.active ?? "—", variant: "success" },
    ],
    actions: [
      { label: "Excursões", path: "/excursoes", icon: Bus },
      { label: "Nova excursão", path: "/excursoes/nova" },
      { label: "Leads", path: "/leads", icon: Users2 },
    ],
  },
  {
    title: "Cadastros e Configurações",
    description: "Cartões, configurações do site público e conteúdo editável da landing page.",
    icon: Settings2,
    iconColor: "text-muted-foreground",
    features: [
      { label: "Cartões", path: "/cartoes" },
      { label: "Configurações", path: "/configuracoes" },
      { label: "Landing Page", path: "/landing-settings" },
      { label: "Site Público", path: "/configuracoes/publico" },
    ],
    getIndicators: () => [],
    actions: [
      { label: "Cartões", path: "/cartoes", icon: CreditCard },
      { label: "Configurações", path: "/configuracoes", icon: Settings2 },
    ],
  },
  {
    title: "Suporte e Governança",
    description: "Diagnóstico do sistema, auditoria de alterações e ações de manutenção seguras.",
    icon: Shield,
    iconColor: "text-review",
    features: [
      { label: "Diagnóstico", path: "/diagnostico" },
      { label: "Auditoria", path: "/auditoria" },
    ],
    getIndicators: () => [],
    actions: [
      { label: "Diagnóstico", path: "/diagnostico", icon: Bug },
      { label: "Auditoria", path: "/auditoria", icon: FileText },
    ],
  },
];

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

export default function AdminPanel() {
  const { data: stats, isLoading, isError } = useAdminStats();

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Painel de Administração</h1>
        <p className="page-subtitle">Visão geral de todos os módulos do sistema em um só lugar.</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Erro ao carregar indicadores. Tente recarregar a página.
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group, i) => (
            <AdminGroupCard
              key={group.title}
              title={group.title}
              description={group.description}
              icon={group.icon}
              iconColor={group.iconColor}
              features={group.features}
              indicators={group.getIndicators(stats)}
              actions={group.actions}
              index={i}
            />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
