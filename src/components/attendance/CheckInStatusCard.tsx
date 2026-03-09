import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, QrCode, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CheckInStatusCardProps {
  distance: number | null;
  accuracy: number | null;
  radiusMeters: number;
  isInRange: boolean;
  locationError: string | null;
  locationLoading: boolean;
  onConfirmGps: () => void;
  onOpenQr: () => void;
  isCheckingIn: boolean;
  busName?: string;
}

export function CheckInStatusCard({
  distance,
  accuracy,
  radiusMeters,
  isInRange,
  locationError,
  locationLoading,
  onConfirmGps,
  onOpenQr,
  isCheckingIn,
  busName,
}: CheckInStatusCardProps) {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Location info */}
        <div className="space-y-2">
          {locationLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Obtendo localização...
            </div>
          )}
          {locationError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {locationError}
            </div>
          )}
          {distance !== null && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${isInRange ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
              <MapPin className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {isInRange
                    ? "Você está na área de embarque!"
                    : `Você está a ${Math.round(distance)}m do ponto de embarque`}
                </p>
                {accuracy && <p className="text-xs opacity-70">Precisão: ±{Math.round(accuracy)}m</p>}
              </div>
            </div>
          )}
        </div>

        {busName && (
          <p className="text-sm text-muted-foreground">
            Ônibus: <span className="font-medium text-foreground">{busName}</span>
          </p>
        )}

        {/* GPS confirm button */}
        <Button
          className="w-full h-14 text-base font-semibold"
          size="lg"
          disabled={!isInRange || isCheckingIn}
          onClick={onConfirmGps}
        >
          {isCheckingIn ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          Confirmar Presença
        </Button>

        {/* QR alternative */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onOpenQr}
          disabled={isCheckingIn}
        >
          <QrCode className="h-4 w-4 mr-2" /> Escanear QR Code do ônibus
        </Button>
      </CardContent>
    </Card>
  );
}
