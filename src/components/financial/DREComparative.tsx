import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatMonthRef, getCurrentMonthRef, getPreviousMonthRef } from "@/lib/formatters";
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DRELine {
  label: string;
  key: string;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
}

const DRE_LINES: DRELine[] = [
  { label: "Receita Bruta", key: "receitaBruta", bold: true },
  { label: "(-) Custos", key: "custos", indent: true },
  { label: "= Lucro Bruto", key: "lucroBruto", bold: true, separator: true },
  { label: "(-) Despesas", key: "despesas", indent: true },
  { label: "= Resultado Operacional", key: "resultadoOperacional", bold: true, separator: true },
  { label: "(±) Outras", key: "outras", indent: true },
  { label: "= Resultado Líquido", key: "lucroPrejuizo", bold: true, separator: true },
];

function useDRE(month: string) {
  return useQuery({
    queryKey: ["dre-compare", month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dre_summary", { p_month: month });
      if (error) throw error;
      const r = data as { receitas: number; custos: number; despesas: number; outras: number; billing_revenue: number };
      const receitaBruta = (r.billing_revenue || 0) + (r.receitas || 0);
      const lucroBruto = receitaBruta - (r.custos || 0);
      const resultadoOperacional = lucroBruto - (r.despesas || 0);
      return {
        receitaBruta,
        custos: r.custos || 0,
        lucroBruto,
        despesas: r.despesas || 0,
        resultadoOperacional,
        outras: r.outras || 0,
        lucroPrejuizo: resultadoOperacional + (r.outras || 0),
      };
    },
  });
}

export function DREComparative() {
  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }), []);

  const [monthA, setMonthA] = useState(getCurrentMonthRef());
  const [monthB, setMonthB] = useState(getPreviousMonthRef(getCurrentMonthRef()));

  const { data: dreA, isLoading: loadA } = useDRE(monthA);
  const { data: dreB, isLoading: loadB } = useDRE(monthB);

  const isLoading = loadA || loadB;

  const variation = (a: number, b: number) => {
    if (b === 0) return a === 0 ? 0 : 100;
    return ((a - b) / Math.abs(b)) * 100;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">DRE Comparativo</CardTitle>
        <div className="flex flex-wrap gap-3 mt-2">
          <Select value={monthA} onValueChange={setMonthA}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{formatMonthRef(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground self-center">vs</span>
          <Select value={monthB} onValueChange={setMonthB}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{formatMonthRef(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Conta</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">{formatMonthRef(monthA)}</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">{formatMonthRef(monthB)}</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {DRE_LINES.map((line) => {
                  const valA = (dreA as any)?.[line.key] || 0;
                  const valB = (dreB as any)?.[line.key] || 0;
                  const pct = variation(valA, valB);

                  return (
                    <tr key={line.key} className={cn("border-b last:border-0", line.separator && "border-t-2")}>
                      <td className={cn("py-2 px-2", line.indent && "pl-6", line.bold && "font-semibold text-foreground")}>
                        {line.label}
                      </td>
                      <td className="text-right py-2 px-2 font-mono">{formatCurrency(valA)}</td>
                      <td className="text-right py-2 px-2 font-mono text-muted-foreground">{formatCurrency(valB)}</td>
                      <td className="text-right py-2 px-2">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          pct > 0 ? "text-primary" : pct < 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {pct > 0 ? <TrendingUp className="h-3 w-3" /> : pct < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {Math.abs(pct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
