import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { PageTransition, StaggeredList, StaggeredItem } from "@/components/ui/page-transition";
import { formatCurrency, formatMonthRef, getCurrentMonthRef } from "@/lib/formatters";
import {
  Users,
  Receipt,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "react-router-dom";

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const currentMonth = getCurrentMonthRef();

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Visão geral do mês de {formatMonthRef(currentMonth)}
          </p>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <StaggeredList className="space-y-8">
            {/* Main stats */}
            <StaggeredItem>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Pagadores Ativos"
                  value={stats?.activePayers || 0}
                  subtitle={`de ${stats?.totalPayers || 0} total`}
                  icon={Users}
                  variant="positive"
                />
                <StatCard
                  title="Receita Esperada"
                  value={formatCurrency(stats?.expectedRevenueCents || 0)}
                  subtitle={`${stats?.billingsThisMonth || 0} cobranças`}
                  icon={DollarSign}
                  variant="neutral"
                />
                <StatCard
                  title="Receita Recebida"
                  value={formatCurrency(stats?.actualRevenueCents || 0)}
                  subtitle={`${stats?.paidBillings || 0} pagos`}
                  icon={CheckCircle2}
                  variant="positive"
                />
                <StatCard
                  title="Pendente"
                  value={formatCurrency(stats?.pendingRevenueCents || 0)}
                  subtitle={`${stats?.openBillings || 0} em aberto`}
                  icon={Clock}
                  variant="warning"
                />
              </div>
            </StaggeredItem>

            {/* Secondary stats */}
            <StaggeredItem>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Billing status breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt className="h-5 w-5" />
                      Status dos Boletos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status="paid" />
                          <span className="text-sm">Pagos</span>
                        </div>
                        <span className="font-semibold">{stats?.paidBillings || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status="open" />
                          <span className="text-sm">Em Aberto</span>
                        </div>
                        <span className="font-semibold">{stats?.openBillings || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status="cancelled" />
                          <span className="text-sm">Cancelados</span>
                        </div>
                        <span className="font-semibold">{stats?.cancelledBillings || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status="review" />
                          <span className="text-sm">Revisão</span>
                        </div>
                        <span className="font-semibold">{stats?.reviewBillings || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-destructive" />
                          <span className="text-sm">Pagamentos Atrasados</span>
                        </div>
                        <span className="font-semibold text-destructive">
                          {stats?.latePayments || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-review/5 border border-review/10">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-review" />
                          <span className="text-sm">Precisam Revisão</span>
                        </div>
                        <span className="font-semibold text-review">
                          {stats?.reviewBillings || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted border">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Pagadores Inativos</span>
                        </div>
                        <span className="font-semibold text-muted-foreground">
                          {stats?.inactivePayers || 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Link
                        to="/importar"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                          <Receipt className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Importar Boletos</p>
                          <p className="text-xs text-muted-foreground">
                            Atualizar cobranças do mês
                          </p>
                        </div>
                      </Link>
                      <Link
                        to="/pagadores"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                          <Users className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Ver Pagadores</p>
                          <p className="text-xs text-muted-foreground">
                            Gerenciar alunos e cobranças
                          </p>
                        </div>
                      </Link>
                      <Link
                        to="/financeiro"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">DRE Mensal</p>
                          <p className="text-xs text-muted-foreground">
                            Demonstrativo de resultados
                          </p>
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </StaggeredItem>
          </StaggeredList>
        )}
      </PageTransition>
    </MainLayout>
  );
}
