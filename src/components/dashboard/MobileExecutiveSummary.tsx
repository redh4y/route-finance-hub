import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";

interface MobileExecutiveSummaryProps {
  activePayers: number;
  revenueCents: number;
  costsCents: number;
  resultCents: number;
  openBillings: number;
  openValueCents: number;
  overdueCount: number;
  overdueValueCents: number;
  reviewCount: number;
}

export function MobileExecutiveSummary({
  activePayers,
  revenueCents,
  costsCents,
  resultCents,
  openBillings,
  openValueCents,
  overdueCount,
  overdueValueCents,
  reviewCount,
}: MobileExecutiveSummaryProps) {
  const isPositive = resultCents >= 0;

  return (
    <div className="lg:hidden space-y-3">
      {/* Result hero */}
      <Card className={`border-l-4 ${isPositive ? "border-l-primary" : "border-l-destructive"}`}>
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Resultado</p>
              <p className={`text-2xl font-bold ${isPositive ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(resultCents)}
              </p>
            </div>
            <div className={`p-3 rounded-full ${isPositive ? "bg-primary/10" : "bg-destructive/10"}`}>
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-primary" />
              ) : (
                <TrendingDown className="h-6 w-6 text-destructive" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-primary" />
              {formatCurrency(revenueCents)}
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-destructive" />
              {formatCurrency(costsCents)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Alunos Ativos</span>
            </div>
            <p className="text-xl font-bold text-foreground">{activePayers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Em Aberto</span>
            </div>
            <p className="text-xl font-bold text-foreground">{openBillings}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(openValueCents)}</p>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? "border-destructive/30" : ""}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Vencidos</span>
            </div>
            <p className={`text-xl font-bold ${overdueCount > 0 ? "text-destructive" : "text-foreground"}`}>
              {overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">{formatCurrency(overdueValueCents)}</p>
          </CardContent>
        </Card>

        <Link to="/revisao">
          <Card className={`h-full ${reviewCount > 0 ? "border-warning/30" : ""}`}>
            <CardContent className="py-3 px-4 h-full flex flex-col justify-between">
              <div>
              <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Revisão</span>
                </div>
                <p className="text-xl font-bold text-foreground">{reviewCount}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary mt-1">
                <span>Ver inbox</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
