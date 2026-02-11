import { Bus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Seat {
  id: string;
  seat_number: number;
  status: string;
  blocked: boolean;
}

interface SeatMapProps {
  seats: Seat[] | undefined;
  totalSeats: number;
  selectedSeats: number[];
  onToggleSeat: (sn: number) => void;
}

const statusStyles: Record<string, string> = {
  DISPONIVEL: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/50 cursor-pointer",
  RESERVADO: "bg-warning/15 text-warning border-warning/30 cursor-not-allowed",
  VENDIDO: "bg-muted text-muted-foreground/50 border-border cursor-not-allowed",
  BLOQUEADO: "bg-muted/50 text-muted-foreground/30 border-transparent cursor-not-allowed",
};

export function SeatMap({ seats, totalSeats, selectedSeats, onToggleSeat }: SeatMapProps) {
  const seatRows: number[][] = [];
  const total = seats?.length || totalSeats;
  for (let i = 0; i < total; i += 4) {
    const row: number[] = [];
    for (let j = 0; j < 4 && i + j < total; j++) row.push(i + j + 1);
    seatRows.push(row);
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
          Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary border border-primary" />
          Selecionado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/40" />
          Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted border border-border" />
          Vendido
        </span>
      </div>

      {/* Bus layout */}
      <div className="bg-muted/30 rounded-xl p-4 border">
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-t-xl bg-muted border border-b-0 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <Bus className="h-3 w-3" />
            Frente
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto space-y-1.5 px-2">
          {seatRows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1.5">
              {row.map((sn, ci) => {
                const seat = seats?.find((s) => s.seat_number === sn);
                const status = seat?.blocked ? "BLOQUEADO" : seat?.status || "DISPONIVEL";
                const isSelected = selectedSeats.includes(sn);
                const isAvailable = status === "DISPONIVEL";

                return (
                  <div key={sn} className="contents">
                    <button
                      onClick={() => onToggleSeat(sn)}
                      disabled={!isAvailable}
                      aria-label={`Assento ${sn} - ${isSelected ? "selecionado" : status.toLowerCase()}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "w-10 h-10 sm:w-11 sm:h-11 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 scale-105"
                          : statusStyles[status] || statusStyles.DISPONIVEL
                      )}
                    >
                      {sn}
                    </button>
                    {ci === 1 && <div className="w-3 sm:w-4" aria-hidden />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
