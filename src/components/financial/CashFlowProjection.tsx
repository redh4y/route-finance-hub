import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatMonthRef } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";

interface CashFlowMonth {
  month: string;
  label: string;
  receitaPrevista: number;
  despesaPrevista: number;
  saldo: number;
}

export function CashFlowProjection() {
  const { data: months = [], isLoading } = useQuery({
    queryKey: ["cash-flow-projection"],
    queryFn: async () => {
      const now = new Date();
      const result: CashFlowMonth[] = [];

      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        // Revenue: billing expected for this month
        const { data: billings } = await supabase
          .from("billings")
          .select("amount_expected_cents")
          .eq("reference_month", month)
          .neq("status", "CANCELADO");

        const receita = (billings || []).reduce((s, b) => s + b.amount_expected_cents, 0);

        // Expenses: financial entries of type CUSTO or DESPESA
        const { data: entries } = await supabase
          .from("financial_entries")
          .select("amount_cents")
          .eq("competence_month", month)
          .in("type", ["CUSTO", "DESPESA"]);

        const despesa = (entries || []).reduce((s, e) => s + e.amount_cents, 0);

        result.push({
          month,
          label: formatMonthRef(month),
          receitaPrevista: receita,
          despesaPrevista: despesa,
          saldo: receita - despesa,
        });
      }

      return result;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Fluxo de Caixa Projetado
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Próximos 6 meses — receitas previstas vs despesas
        </p>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Sem dados</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={months} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 100).toLocaleString("pt-BR", { notation: "compact" })}`}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "receitaPrevista" ? "Receita" : name === "despesaPrevista" ? "Despesa" : "Saldo",
                  ]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend formatter={(v) => v === "receitaPrevista" ? "Receita" : v === "despesaPrevista" ? "Despesa" : "Saldo"} />
                <ReferenceLine y={0} className="stroke-border" />
                <Bar dataKey="receitaPrevista" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesaPrevista" fill="hsl(var(--destructive) / 0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
              {months.map((m) => (
                <div key={m.month} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className={`text-xs font-bold ${m.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(m.saldo)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
