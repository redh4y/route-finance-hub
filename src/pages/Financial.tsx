import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatMonthRef, getCurrentMonthRef } from "@/lib/formatters";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Minus,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
} from "lucide-react";

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
      // Use server-side aggregation to avoid the 1000-row limit
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

      const receitaBruta = (result.billing_revenue || 0) + (result.receitas || 0);
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

function DRESkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function Financial() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef());
  const { data: dre, isLoading } = useDREData(selectedMonth);

  // Generate last 12 months for selector
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const isPositive = (dre?.lucroPrejuizo || 0) >= 0;

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">DRE - Demonstrativo de Resultados</h1>
            <p className="page-subtitle">Análise financeira mensal</p>
          </div>
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

      {isLoading ? (
        <DRESkeleton />
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Summary cards */}
          <div className="grid gap-6 md:grid-cols-3">
            <StatCard
              title="Receita Bruta"
              value={formatCurrency(dre?.receitaBruta || 0)}
              icon={ArrowUpCircle}
              variant="positive"
            />
            <StatCard
              title="Custos + Despesas"
              value={formatCurrency((dre?.custos || 0) + (dre?.despesas || 0))}
              icon={ArrowDownCircle}
              variant="negative"
            />
            <StatCard
              title="Resultado"
              value={formatCurrency(dre?.lucroPrejuizo || 0)}
              icon={isPositive ? TrendingUp : TrendingDown}
              variant={isPositive ? "positive" : "negative"}
            />
          </div>

          {/* DRE Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Demonstrativo Detalhado - {formatMonthRef(selectedMonth)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <DRELine
                  label="RECEITA BRUTA"
                  value={dre?.receitaBruta || 0}
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
                  isSubtotal
                />
                
                <div className="h-2" />
                
                <DRELine
                  label="(-) CUSTOS OPERACIONAIS"
                  value={dre?.custos || 0}
                  isHeader
                />
                <DRELine
                  label="= LUCRO BRUTO"
                  value={dre?.lucroBruto || 0}
                  isSubtotal
                  positive={dre?.lucroBruto ? dre.lucroBruto >= 0 : true}
                />
                
                <div className="h-2" />
                
                <DRELine
                  label="(-) DESPESAS OPERACIONAIS"
                  value={dre?.despesas || 0}
                  isHeader
                />
                <DRELine
                  label="= RESULTADO OPERACIONAL"
                  value={dre?.resultadoOperacional || 0}
                  isSubtotal
                  positive={dre?.resultadoOperacional ? dre.resultadoOperacional >= 0 : true}
                />
                
                <div className="h-2" />
                
                <DRELine
                  label="(+/-) OUTRAS RECEITAS/DESPESAS"
                  value={dre?.outras || 0}
                  isHeader
                />
                
                <div className="h-4" />
                
                <DRELine
                  label="LUCRO/PREJUÍZO DO PERÍODO"
                  value={dre?.lucroPrejuizo || 0}
                  isTotal
                  positive={isPositive}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}

interface DRELineProps {
  label: string;
  value: number;
  indent?: boolean;
  isHeader?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  positive?: boolean;
}

function DRELine({ 
  label, 
  value, 
  indent, 
  isHeader, 
  isSubtotal, 
  isTotal,
  positive 
}: DRELineProps) {
  return (
    <div
      className={`flex items-center justify-between py-3 px-4 rounded-lg ${
        isTotal
          ? positive
            ? "bg-success/10 border border-success/20"
            : "bg-destructive/10 border border-destructive/20"
          : isSubtotal
          ? "bg-muted/50"
          : isHeader
          ? "bg-muted/30"
          : ""
      } ${indent ? "ml-6" : ""}`}
    >
      <span
        className={`${
          isTotal
            ? "font-bold text-lg"
            : isSubtotal
            ? "font-semibold"
            : isHeader
            ? "font-medium"
            : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          isTotal
            ? `font-bold text-lg ${positive ? "text-success" : "text-destructive"}`
            : isSubtotal
            ? `font-semibold ${positive !== undefined ? (positive ? "text-success" : "text-destructive") : ""}`
            : ""
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
