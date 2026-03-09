import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DailyTripCard } from "@/components/attendance/DailyTripCard";
import { useTodayTrips, useStudentAttendanceToday } from "@/hooks/useAttendance";
import { supabase } from "@/integrations/supabase/client";
import { Bus, History, User, HelpCircle, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("student_id");
  const studentName = localStorage.getItem("student_name");
  const [routeId, setRouteId] = useState<string | undefined>();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!studentId) {
      navigate("/presenca/login");
      return;
    }

    // Check student + payer status via edge function
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("student-auth", {
          body: { action: "check_status", studentId },
        });

        if (!data?.ok && data?.blocked) {
          setBlocked(true);
          toast.error("Seu cadastro foi inativado. Procure a coordenação.");
          return;
        }
      } catch {
        // If edge function fails, don't block — just continue
      }

      // Get route
      const { data: student } = await (supabase as any)
        .from("students")
        .select("default_route_id")
        .eq("id", studentId)
        .single();

      if (student?.default_route_id) setRouteId(student.default_route_id);
    })();
  }, [studentId, navigate]);

  const { data: trips } = useTodayTrips(routeId);
  const { data: attendanceToday } = useStudentAttendanceToday(studentId || undefined);

  const outboundTrip = trips?.find((t: any) => t.trip_type === "OUTBOUND");
  const returnTrip = trips?.find((t: any) => t.trip_type === "RETURN");
  const outboundAttendance = attendanceToday?.find((a: any) => a.trip_type === "OUTBOUND");
  const returnAttendance = attendanceToday?.find((a: any) => a.trip_type === "RETURN");

  const handleLogout = () => {
    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    localStorage.removeItem("student_registration");
    navigate("/presenca/login");
  };

  if (blocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit">
            <Bus className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-lg font-bold">Acesso bloqueado</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro no transporte foi inativado. Procure a coordenação para regularizar sua situação.
          </p>
          <Button variant="outline" onClick={handleLogout}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm opacity-80">Olá,</p>
            <h1 className="text-lg font-bold">{studentName}</h1>
          </div>
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="p-4 -mt-3 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base">Hoje</h2>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <DailyTripCard
          tripType="OUTBOUND"
          attendance={outboundAttendance}
          boardingStart={outboundTrip?.boarding_start_time?.slice(0, 5)}
          boardingEnd={outboundTrip?.boarding_end_time?.slice(0, 5)}
        />
        <DailyTripCard
          tripType="RETURN"
          attendance={returnAttendance}
          boardingStart={returnTrip?.boarding_start_time?.slice(0, 5)}
          boardingEnd={returnTrip?.boarding_end_time?.slice(0, 5)}
        />

        {(!outboundAttendance || !returnAttendance) && (
          <Button
            className="w-full h-14 text-base font-semibold"
            size="lg"
            onClick={() => navigate("/presenca/checkin")}
          >
            <MapPin className="h-5 w-5 mr-2" />
            Confirmar Presença
          </Button>
        )}

        {outboundAttendance && returnAttendance && (
          <div className="bg-primary/10 text-primary p-4 rounded-lg text-center text-sm font-medium">
            ✅ Todas as presenças do dia estão confirmadas!
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 pt-2">
          <Link to="/presenca/historico" className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border text-center hover:bg-muted transition-colors">
            <History className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Histórico</span>
          </Link>
          <Link to="/presenca/perfil" className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border text-center hover:bg-muted transition-colors">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Perfil</span>
          </Link>
          <Link to="/presenca/ajuda" className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border text-center hover:bg-muted transition-colors">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Ajuda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
