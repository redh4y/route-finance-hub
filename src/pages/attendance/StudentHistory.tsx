import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAttendanceHistory } from "@/hooks/useAttendance";
import { ArrowLeft, ArrowRight, Bus, MapPin, QrCode, UserCheck } from "lucide-react";

const methodIcons: Record<string, typeof MapPin> = { gps: MapPin, qr: QrCode, manual_assisted: UserCheck };
const methodLabels: Record<string, string> = { gps: "GPS", qr: "QR Code", manual_assisted: "Manual" };

export default function StudentHistory() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("student_id");
  const { data: history, isLoading } = useAttendanceHistory(studentId || undefined);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/presenca")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">Histórico de Presenças</h1>
      </header>

      <div className="p-4 space-y-3">
        {isLoading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}
        {!isLoading && (!history || history.length === 0) && (
          <p className="text-center text-muted-foreground py-8">Nenhuma presença registrada.</p>
        )}
        {history?.map((a: any) => {
          const MethodIcon = methodIcons[a.method] || MapPin;
          return (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {new Date(a.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {a.trip_type === "OUTBOUND" ? (
                          <><ArrowRight className="h-3 w-3 mr-1" /> Ida</>
                        ) : (
                          <><ArrowLeft className="h-3 w-3 mr-1" /> Volta</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <MethodIcon className="h-3 w-3 mr-1" /> {methodLabels[a.method] || a.method}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-1">
                    <p>{new Date(a.check_in_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    {a.transport_buses && (
                      <p className="flex items-center gap-1 justify-end">
                        <Bus className="h-3 w-3" /> {a.transport_buses.name}
                      </p>
                    )}
                    <Badge variant={a.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                      {a.status === "confirmed" ? "Confirmada" : a.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
