import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bus, ArrowRight, ArrowLeft, CheckCircle2, Clock } from "lucide-react";

interface DailyTripCardProps {
  tripType: "OUTBOUND" | "RETURN";
  attendance?: { check_in_time: string; transport_buses?: { name: string } | null; method: string } | null;
  boardingStart?: string;
  boardingEnd?: string;
}

export function DailyTripCard({ tripType, attendance, boardingStart, boardingEnd }: DailyTripCardProps) {
  const isOutbound = tripType === "OUTBOUND";
  const label = isOutbound ? "Ida para faculdade" : "Volta para casa";
  const Icon = isOutbound ? ArrowRight : ArrowLeft;
  const confirmed = !!attendance;

  return (
    <Card className={`transition-all ${confirmed ? "border-success/40 bg-success/5" : "border-border"}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${confirmed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">{label}</p>
              {boardingStart && boardingEnd && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {boardingStart} - {boardingEnd}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            {confirmed ? (
              <div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmada
                </Badge>
                {attendance?.transport_buses?.name && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <Bus className="h-3 w-3" /> {attendance.transport_buses.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(attendance!.check_in_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Pendente
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
