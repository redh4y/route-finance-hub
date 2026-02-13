import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, AlertTriangle, Clock } from "lucide-react";
import { useMaintenanceDashboardStats } from "@/hooks/useMaintenanceTickets";
import { useNavigate } from "react-router-dom";

export function DashboardMaintenanceBlock() {
  const { data: stats, isLoading } = useMaintenanceDashboardStats();
  const navigate = useNavigate();

  if (isLoading || !stats) return null;
  if (stats.openCount === 0) return null;

  return (
    <Card className={stats.criticalCount > 0 ? "border-destructive/30" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="h-5 w-5 text-warning" />
          Manutenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.openCount}</p>
            <p className="text-xs text-muted-foreground">Em aberto</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{stats.criticalCount}</p>
            <p className="text-xs text-muted-foreground">Críticos/Alta</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">{stats.overdueCount}</p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/manutencao")}>
          Ver manutenção
        </Button>
      </CardContent>
    </Card>
  );
}
