import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCurrency,
  formatMonthRef,
  getCurrentMonthRef,
  getPreviousMonthRef,
  formatPercentage,
} from "@/lib/formatters";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  ArrowRight,
  BarChart3,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface DREData {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  despesas: number;
  resultadoOperacional: number;
  outras: number;
  lucroPrejuizo: number;
}

function useDREData(month: string) {
  return useQuery({
    queryKey: ["dre", month],
    queryFn: async (): Promise<DREData> => {
      const { data, error } = await supabase.rpc("get_dre_summary", {
        p_month: month,
      });

      if (error) throw error;

      const result = data as {
        receitas: number;
        custos: number;
        despesas: number;
        outras: number;
        billing_revenue: number;
      };

      const receitaBruta =
        (result.billing_revenue || 0) + (result.receitas || 0);
      const deducoes = 0;
      const receitaLiquida = receitaBruta - deducoes;
      const lucroBruto = receitaLiquida - (result.custos || 0);
      const resultadoOperacional = lucroBruto - (result.despesas || 0);
      const lucroPrejuizo = resultadoOperacional + (result.outras || 0);

      return {
        receitaBruta,
        deducoes,
        receitaLiquida,
        custos: result.custos || 0,
        lucroBruto,
        despesas: result.despesas || 0,
        resultadoOperacional,
        outras: result.outras || 0,
        lucroPrejuizo,
      };
    },
  });
}

export default function Financial() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const prevMonth = getPreviousMonthRef(selectedMonth);
  const { data: dre, isLoading } = useDREData(selectedMonth);
  const { data: drePrev } = useDREData(prevMonth);
  const navigate = useNavigate();

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }),
    [],
  );

  const isPositive = (dre?.lucroPrejuizo || 0) >= 0;

  // MoM trend calculation
  function calcTrend(curr?: number, prev?: number) {
    if (!prev || prev === 0 || curr === undefined) return undefined;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { value: Math.round(pct * 10) / 10, isPositive: pct >= 0 };
  }

  // Margin percentage
  const marginPct =
    dre && dre.receitaBruta > 0
      ? (dre.lucroPrejuizo / dre.receitaBruta) * 100
      : 0;

  // Waterfall chart data
  const chartData = useMemo(() => {
    if (!dre) return [];
    return [
      { name: "Receita", value: dre.receitaBruta, color: "hsl(160, 84%, 39%)" },
      { name: "Custos", value: -dre.custos, color: "hsl(0, 84%, 60%)" },
      { name: "Lucro Bruto", value: dre.lucroBruto, color: dre.lucroBruto >= 0 ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)" },
      { name: "Despesas", value: -dre.despesas, color: "hsl(38, 92%, 50%)" },
      { name: "Outras", value: dre.outras, color: "hsl(217, 91%, 60%)" },
      { name: "Resultado", value: dre.lucroPrejuizo, color: dre.lucroPrejuizo >= 0 ? "hsl(160, 84%, 39%)" : "hsl(0, 84%, 60%)" },
    ];
  }, [dre]);

  const formatChartValue = (v: number) => formatCurrency(Math.abs(v));

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title">DRE - Demonstrativo de Resultados</h1>
              <p className="page-subtitle">
                Análise financeira mensal &middot; {formatMonthRef(selectedMonth)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthRef(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick nav */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/financeiro/entradas")}
              className="gap-1.5"
            >
              <ArrowUpCircle className="h-4 w-4 text-success" />
              Entradas
              <ArrowRight className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/financeiro/saidas")}
              className="gap-1.5"
            >
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
              Saídas
              <ArrowRight className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/relatorios")}
              className="gap-1.5"
            >
              <BarChart3 className="h-4 w-4 text-accent" />
              Relatórios
              <ArrowRight className="h-3 w-3 ml-1 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <DRESkeleton />
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Summary cards */}
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Receita Bruta"
                value={formatCurrency(dre?.receitaBruta || 0)}
                icon={ArrowUpCircle}
                variant="positive"
                trend={calcTrend(dre?.receitaBruta, drePrev?.receitaBruta)}
              />
              <StatCard
                title="Custos Operacionais"
                value={formatCurrency(dre?.custos || 0)}
                icon={ArrowDownCircle}
                variant="negative"
                trend={calcTrend(dre?.custos, drePrev?.custos)}
              />
              <StatCard
                title="Despesas"
                value={formatCurrency(dre?.despesas || 0)}
                icon={Minus}
                variant="warning"
                trend={calcTrend(dre?.despesas, drePrev?.despesas)}
              />
              <StatCard
                title="Resultado"
                value={formatCurrency(dre?.lucroPrejuizo || 0)}
                icon={isPositive ? TrendingUp : TrendingDown}
                variant={isPositive ? "positive" : "negative"}
                trend={calcTrend(dre?.lucroPrejuizo, drePrev?.lucroPrejuizo)}
              />
            </div>

            {/* Margin indicator */}
            <Card>
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Margem Líquida
                  </span>
                  <span
                    className={`text-sm font-bold ${marginPct >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatPercentage(marginPct)}
                  </span>
                </div>
                <Progress
                  value={Math.min(Math.max(marginPct, 0), 100)}
                  className="h-2"
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-5 w-5 text-accent" />
                    Composição do Resultado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${(v / 100).toLocaleString("pt-BR", { notation: "compact" })}`}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [formatCurrency(Math.abs(value)), ""]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* DRE Table */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5 text-accent" />
                    Demonstrativo Detalhado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <DRELine
                      label="RECEITA BRUTA"
                      value={dre?.receitaBruta || 0}
                      prevValue={drePrev?.receitaBruta}
                      isHeader
                      positive
                    />
                    <DRELine
                      label="(-) Deduções"
                      value={dre?.deducoes || 0}
                      indent
                    />
                    <DRELine
                      label="= RECEITA LÍQUIDA"
                      value={dre?.receitaLiquida || 0}
                      prevValue={drePrev?.receitaLiquida}
                      isSubtotal
                    />

                    <div className="h-2" />

                    <DRELine
                      label="(-) CUSTOS OPERACIONAIS"
                      value={dre?.custos || 0}
                      prevValue={drePrev?.custos}
                      isHeader
                    />
                    <DRELine
                      label="= LUCRO BRUTO"
                      value={dre?.lucroBruto || 0}
                      prevValue={drePrev?.lucroBruto}
                      isSubtotal
                      positive={dre?.lucroBruto ? dre.lucroBruto >= 0 : true}
                    />

                    <div className="h-2" />

                    <DRELine
                      label="(-) DESPESAS OPERACIONAIS"
                      value={dre?.despesas || 0}
                      prevValue={drePrev?.despesas}
                      isHeader
                    />
                    <DRELine
                      label="= RESULTADO OPERACIONAL"
                      value={dre?.resultadoOperacional || 0}
                      prevValue={drePrev?.resultadoOperacional}
                      isSubtotal
                      positive={
                        dre?.resultadoOperacional
                          ? dre.resultadoOperacional >= 0
                          : true
                      }
                    />

                    <div className="h-2" />

                    <DRELine
                      label="(+/-) OUTRAS RECEITAS/DESPESAS"
                      value={dre?.outras || 0}
                      prevValue={drePrev?.outras}
                      isHeader
                    />

                    <div className="h-4" />

                    <DRELine
                      label="LUCRO/PREJUÍZO DO PERÍODO"
                      value={dre?.lucroPrejuizo || 0}
                      prevValue={drePrev?.lucroPrejuizo}
                      isTotal
                      positive={isPositive}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </PageTransition>
    </MainLayout>
  );
}

/* ─── Skeleton ─── */
function DRESkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}

/* ─── DRE Line ─── */
interface DRELineProps {
  label: string;
  value: number;
  prevValue?: number;
  indent?: boolean;
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  positive?: boolean;
}

function DRELine({
  label,
  value,
  prevValue,
  indent,
  isHeader,
  isSubtotal,
  isTotal,
  positive,
}: DRELineProps) {
  const momPct =
    prevValue && prevValue !== 0
      ? ((value - prevValue) / Math.abs(prevValue)) * 100
      : undefined;

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-4 rounded-lg transition-colors ${
        isTotal
          ? positive
            ? "bg-success/10 border border-success/20"
            : "bg-destructive/10 border border-destructive/20"
          : isSubtotal
            ? "bg-muted/50"
            : isHeader
              ? "bg-muted/30"
              : "hover:bg-muted/20"
      } ${indent ? "ml-6" : ""}`}
    >
      <span
        className={`${
          isTotal
            ? "font-bold text-base"
            : isSubtotal
              ? "font-semibold text-sm"
              : isHeader
                ? "font-medium text-sm"
                : "text-sm text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <div className="flex items-center gap-3">
        {/* MoM badge */}
        {momPct !== undefined && (isSubtotal || isTotal || isHeader) && (
          <span
            className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
              momPct >= 0
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {momPct >= 0 ? "+" : ""}
            {momPct.toFixed(1)}%
          </span>
        )}
        <span
          className={`font-mono tabular-nums ${
            isTotal
              ? `font-bold text-base ${positive ? "text-success" : "text-destructive"}`
              : isSubtotal
                ? `font-semibold text-sm ${positive !== undefined ? (positive ? "text-success" : "text-destructive") : ""}`
                : "text-sm"
          }`}
        >
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}
