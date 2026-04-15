import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatMonthRef } from "@/lib/formatters";

type BillingRow = {
  payer_id: string;
  reference_month: string;
  payer: { name: string; document_digits: string | null } | null;
};

type DuplicateEntry = {
  payer_id: string;
  reference_month: string;
  payer: { name: string; document_digits: string | null } | null;
  count: number;
};

export function DashboardDuplicateBillings() {
  const { data: duplicates = [], isLoading } = useQuery<DuplicateEntry[]>({
    queryKey: ["dashboard-duplicate-billings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billings")
        .select("payer_id, reference_month, payer:payers(name, document_digits)")
        .eq("status", "OPEN");
      if (error) throw error;

      const map = new Map<string, DuplicateEntry>();
      for (const b of (data ?? []) as BillingRow[]) {
        const key = `${b.payer_id}__${b.reference_month}`;
        const entry = map.get(key) ?? {
          payer_id: b.payer_id,
          reference_month: b.reference_month,
          payer: b.payer,
          count: 0,
        };
        entry.count++;
        map.set(key, entry);
      }

      return [...map.values()].filter((e) => e.count > 1)
        .sort((a, b) => b.count - a.count || a.reference_month.localeCompare(b.reference_month));
    },
    staleTime: 60_000,
  });

  return (
    <Card className={duplicates.length > 0 ? "border-destructive/40" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${duplicates.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            Boletos Duplicados em Aberto
          </span>
          {duplicates.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {duplicates.length} irregularidade{duplicates.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : duplicates.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Nenhuma duplicata encontrada.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {duplicates.map((d) => (
              <Link
                key={`${d.payer_id}__${d.reference_month}`}
                to={`/financeiro/entradas?payer_id=${d.payer_id}&month=${d.reference_month}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {d.payer?.name ?? d.payer_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.payer?.document_digits ?? "—"} · {formatMonthRef(d.reference_month)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="destructive" className="text-[10px] font-bold">
                    {d.count} boletos
                  </Badge>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
