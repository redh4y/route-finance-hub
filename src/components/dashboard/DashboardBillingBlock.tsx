import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";
import type { BillingKPIs } from "@/hooks/useEnhancedDashboard";

interface Props {
  billingKPIs: BillingKPIs;
}

const items = [
  { key: "paid", label: "Pagos", status: "PAID" as const, badgeStatus: "paid" as const, countKey: "paidCount", valueKey: "paidValueCents" },
  { key: "open", label: "Em Aberto", status: "OPEN" as const, badgeStatus: "open" as const, countKey: "openCount", valueKey: "openValueCents" },
  { key: "cancelled", label: "Cancelados", status: "CANCELADO" as const, badgeStatus: "cancelled" as const, countKey: "cancelledCount", valueKey: "cancelledValueCents" },
  { key: "review", label: "Revisão", status: "NEEDS_REVIEW" as const, badgeStatus: "review" as const, countKey: "reviewCount", valueKey: "reviewValueCents" },
] as const;

export function DashboardBillingBlock({ billingKPIs }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5" />
          Status dos Boletos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((item) => {
            const count = billingKPIs[item.countKey];
            const value = billingKPIs[item.valueKey];
            return (
              <Link
                key={item.key}
                to={`/financeiro/entradas?status=${item.status}`}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center"
              >
                <StatusBadge status={item.badgeStatus} />
                <span className="text-2xl font-bold">{count}</span>
                <span className="text-xs text-muted-foreground">{formatCurrency(value)}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
