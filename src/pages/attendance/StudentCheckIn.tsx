import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckInStatusCard } from "@/components/attendance/CheckInStatusCard";
import { QrScanner } from "@/components/attendance/QrScanner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useTodayTrips, useStudentAttendanceToday, useCheckIn, useTransportBuses } from "@/hooks/useAttendance";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

export default function StudentCheckIn() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem("student_id");
  const [routeId, setRouteId] = useState<string | undefined>();
  const [selectedTripType, setSelectedTripType] = useState<"OUTBOUND" | "RETURN">("OUTBOUND");
  const [showQr, setShowQr] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  const geo = useGeolocation();
  const { data: trips } = useTodayTrips(routeId);
  const { data: attendanceToday } = useStudentAttendanceToday(studentId || undefined);
  const { data: allBuses } = useTransportBuses();
  const checkIn = useCheckIn();

  useEffect(() => {
    if (!studentId) { navigate("/presenca/login"); return; }
    supabase.from("students").select("default_route_id").eq("id", studentId).single()
      .then(({ data }) => { if (data?.default_route_id) setRouteId(data.default_route_id); });
  }, [studentId, navigate]);

  useEffect(() => { geo.requestLocation(); }, []);

  // Auto-detect trip type
  useEffect(() => {
    const outDone = attendanceToday?.some((a: any) => a.trip_type === "OUTBOUND");
    const retDone = attendanceToday?.some((a: any) => a.trip_type === "RETURN");
    if (outDone && !retDone) setSelectedTripType("RETURN");
    else if (!outDone) setSelectedTripType("OUTBOUND");
  }, [attendanceToday]);

  const currentTrip = trips?.find((t: any) => t.trip_type === selectedTripType);
  const route = currentTrip?.transport_routes;
  const alreadyDone = attendanceToday?.some((a: any) => a.trip_type === selectedTripType);

  // Distance calculation
  const distance = route?.boarding_latitude && route?.boarding_longitude
    ? geo.distanceTo(route.boarding_latitude, route.boarding_longitude)
    : null;
  const radiusMeters = route?.radius_meters || 50;
  const isInRange = distance !== null && distance <= radiusMeters;

  // First available bus from trip assignments
  const tripBuses = currentTrip?.bus_assignments?.map((ba: any) => ba.transport_buses).filter(Boolean) || [];
  const defaultBus = tripBuses[0];

  const doCheckIn = useCallback(async (method: string, busId: string) => {
    if (!studentId || !currentTrip) return;
    await checkIn.mutateAsync({
      student_id: studentId,
      bus_id: busId,
      trip_id: currentTrip.id,
      trip_type: selectedTripType,
      method,
      latitude: geo.latitude || undefined,
      longitude: geo.longitude || undefined,
      accuracy: geo.accuracy || undefined,
      evidence: { method, bus_id: busId },
    });
    navigate("/presenca");
  }, [studentId, currentTrip, selectedTripType, geo, checkIn, navigate]);

  const handleGpsConfirm = () => {
    const bus = selectedBusId || defaultBus?.id;
    if (!bus) { toast.error("Nenhum ônibus disponível para esta viagem."); return; }
    doCheckIn("gps", bus);
  };

  const handleQrScan = async (value: string) => {
    setShowQr(false);
    // Find bus by QR code value
    const bus = allBuses?.find((b: any) => b.qr_code_value === value);
    if (!bus) { toast.error("QR Code inválido. Não pertence a nenhum ônibus ativo."); return; }
    if (!bus.active) { toast.error("Este ônibus está inativo."); return; }
    doCheckIn("qr", bus.id);
  };

  if (alreadyDone) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/presenca")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="bg-success/10 text-success p-6 rounded-lg text-center">
          <p className="font-semibold text-lg">Você já confirmou sua {selectedTripType === "OUTBOUND" ? "ida" : "volta"} hoje.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/presenca")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">Confirmar Presença</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Trip type selector */}
        <div className="flex gap-2">
          <Button
            variant={selectedTripType === "OUTBOUND" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setSelectedTripType("OUTBOUND")}
            disabled={attendanceToday?.some((a: any) => a.trip_type === "OUTBOUND")}
          >
            <ArrowRight className="h-4 w-4 mr-1" /> Ida
          </Button>
          <Button
            variant={selectedTripType === "RETURN" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setSelectedTripType("RETURN")}
            disabled={attendanceToday?.some((a: any) => a.trip_type === "RETURN")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Volta
          </Button>
        </div>

        {!currentTrip ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <p>Nenhuma viagem de {selectedTripType === "OUTBOUND" ? "ida" : "volta"} configurada para hoje.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Route info */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Rota</p>
                <p className="font-medium">{route?.name || "—"}</p>
                {route?.boarding_location_name && (
                  <p className="text-xs text-muted-foreground mt-1">{route.boarding_location_name}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Embarque: {currentTrip.boarding_start_time?.slice(0, 5)} - {currentTrip.boarding_end_time?.slice(0, 5)}
                </p>
              </CardContent>
            </Card>

            {/* Bus selection if multiple */}
            {tripBuses.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selecione o ônibus:</p>
                <div className="grid grid-cols-2 gap-2">
                  {tripBuses.map((bus: any) => (
                    <Button
                      key={bus.id}
                      variant={selectedBusId === bus.id ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setSelectedBusId(bus.id)}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-1" />
                      {bus.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <CheckInStatusCard
              distance={distance}
              accuracy={geo.accuracy}
              radiusMeters={radiusMeters}
              isInRange={isInRange}
              locationError={geo.error}
              locationLoading={geo.loading}
              onConfirmGps={handleGpsConfirm}
              onOpenQr={() => setShowQr(true)}
              isCheckingIn={checkIn.isPending}
              busName={(selectedBusId ? tripBuses.find((b: any) => b.id === selectedBusId)?.name : defaultBus?.name) || undefined}
            />
          </>
        )}
      </div>

      {showQr && <QrScanner onScan={handleQrScan} onClose={() => setShowQr(false)} />}
    </div>
  );
}
