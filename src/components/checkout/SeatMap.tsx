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
  DISPONIVEL:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-500/60 hover:scale-[1.08] cursor-pointer active:scale-95",
  RESERVADO:
    "bg-amber-500/10 text-amber-600 border-amber-500/25 cursor-not-allowed opacity-70",
  VENDIDO:
    "bg-muted/60 text-muted-foreground/40 border-border/50 cursor-not-allowed",
  BLOQUEADO:
    "bg-muted/30 text-muted-foreground/20 border-transparent cursor-not-allowed",
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
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-emerald-500/15 border border-emerald-500/40" />
          Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-primary border border-primary shadow-sm shadow-primary/30" />
          Selecionado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-500/15 border border-amber-500/30" />
          Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-muted/60 border border-border/50" />
          Vendido
        </span>
      </div>

      {/* Bus body */}
      <div className="relative bg-gradient-to-b from-muted/40 to-muted/20 rounded-2xl border border-border/60 overflow-hidden">
        {/* Bus front */}
        <div className="flex justify-center py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            <Bus className="h-3.5 w-3.5" />
            Frente do ônibus
          </div>
        </div>

        {/* Seats grid */}
        <div className="max-h-[380px] overflow-y-auto px-3 py-3">
          <div className="space-y-1.5">
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
                          "w-10 h-10 sm:w-11 sm:h-11 rounded-lg border text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 scale-105 ring-2 ring-primary/20"
                            : statusStyles[status] || statusStyles.DISPONIVEL
                        )}
                      >
                        {sn}
                      </button>
                      {ci === 1 && <div className="w-4 sm:w-5" aria-hidden />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bus rear */}
        <div className="flex justify-center py-2 border-t border-border/40 bg-muted/20">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Traseira</span>
        </div>
      </div>
    </div>
  );
}
