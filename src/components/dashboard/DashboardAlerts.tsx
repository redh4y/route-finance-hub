import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import type { SmartAlert } from "@/hooks/useEnhancedDashboard";
import { cn } from "@/lib/utils";

interface Props {
  alerts: SmartAlert[];
}

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap = {
  error: "bg-destructive/5 border-destructive/10 text-destructive",
  warning: "bg-warning/5 border-warning/10 text-warning",
  info: "bg-accent/5 border-accent/10 text-accent",
};

export function DashboardAlerts({ alerts }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Alertas Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/10">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm text-success">Nenhum alerta crítico no momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = iconMap[alert.type];
              return (
                <div
                  key={alert.id}
                  className={cn("flex items-center gap-3 p-3 rounded-lg border", styleMap[alert.type])}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">{alert.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
