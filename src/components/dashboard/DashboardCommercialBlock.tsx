import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { CommercialStats } from "@/hooks/useEnhancedDashboard";

interface Props {
  stats: CommercialStats;
}

export function DashboardCommercialBlock({ stats }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bus className="h-5 w-5" />
          Excursões e Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-accent/5 border border-accent/10">
            <p className="text-2xl font-bold text-accent">{stats.activeExcursions}</p>
            <p className="text-xs text-muted-foreground">Ativas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-warning/5 border border-warning/10">
            <p className="text-2xl font-bold text-warning">{stats.reservedSeats}</p>
            <p className="text-xs text-muted-foreground">Reservados</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/5 border border-success/10">
            <p className="text-2xl font-bold text-success">{stats.soldSeats}</p>
            <p className="text-xs text-muted-foreground">Vendidos</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-2xl font-bold text-primary">{stats.leadsCount}</p>
            <p className="text-xs text-muted-foreground">Leads</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/excursoes">
              <Bus className="h-4 w-4 mr-1.5" /> Excursões
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link to="/leads">
              <UserPlus className="h-4 w-4 mr-1.5" /> Leads
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
