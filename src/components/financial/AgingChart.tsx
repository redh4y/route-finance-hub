import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

interface AgingBucket {
  label: string;
  count: number;
  valueCents: number;
  color: string;
}

export function AgingChart() {
  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ["aging-inadimplencia"],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from("billings")
        .select("due_date, amount_expected_cents")
        .eq("status", "OPEN")
        .not("due_date", "is", null)
        .lt("due_date", today.toISOString().split("T")[0]);

      if (error) throw error;

      const ranges: AgingBucket[] = [
        { label: "1-30 dias", count: 0, valueCents: 0, color: "hsl(var(--warning))" },
        { label: "31-60 dias", count: 0, valueCents: 0, color: "hsl(var(--accent))" },
        { label: "61-90 dias", count: 0, valueCents: 0, color: "hsl(var(--destructive) / 0.7)" },
        { label: "90+ dias", count: 0, valueCents: 0, color: "hsl(var(--destructive))" },
      ];

      (data || []).forEach((b) => {
        if (!b.due_date) return;
        const days = differenceInDays(today, parseISO(b.due_date));
        const idx = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
        ranges[idx].count += 1;
        ranges[idx].valueCents += b.amount_expected_cents;
      });

      return ranges;
    },
  });

  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  const totalValue = buckets.reduce((s, b) => s + b.valueCents, 0);

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
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Aging de Inadimplência
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalCount} boletos vencidos · {formatCurrency(totalValue)}
        </p>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhum boleto vencido 🎉</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={buckets} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Valor"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="valueCents" radius={[6, 6, 0, 0]}>
                  {buckets.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {buckets.map((b) => (
                <div key={b.label} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className="font-bold text-foreground">{b.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(b.valueCents)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
