import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { OperationStats } from "@/hooks/useEnhancedDashboard";

interface Props {
  stats: OperationStats;
}

export function DashboardOperationBlock({ stats }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Operação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/10">
            <p className="text-2xl font-bold text-success">{stats.activePayers}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted border">
            <p className="text-2xl font-bold text-muted-foreground">{stats.inactivePayers}</p>
            <p className="text-xs text-muted-foreground">Inativos</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-review/5 border border-review/10">
            <p className="text-2xl font-bold text-review">{stats.reviewPayers}</p>
            <p className="text-xs text-muted-foreground">Revisão</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/pagadores">
              <Users className="h-4 w-4 mr-1.5" /> Pagadores
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/rotas">
              <MapPin className="h-4 w-4 mr-1.5" /> Rotas
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
