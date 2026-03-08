import { MapPin, Calendar, Bus, Clock, ChevronDown, Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TripSummaryProps {
  excursion: {
    name: string;
    destination: string;
    destination_state?: string | null;
    departure_at: string;
    boarding_location?: string | null;
    seat_price_cents: number;
    pix_expiration_minutes?: number;
  };
  availableSeats: number;
  totalSeats: number;
  selectedSeats: number[];
  paymentType: "TOTAL" | "PARCIAL";
  step: string;
  collapsible?: boolean;
}

function getCommercialStatus(available: number, total: number) {
  if (available === 0) return { label: "Encerrada", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (available <= Math.ceil(total * 0.15)) return { label: "Últimas vagas!", cls: "bg-amber-500/10 text-amber-700 border-amber-500/20 animate-pulse" };
  return { label: "Disponível", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
}

export function TripSummaryCard({
  excursion,
  availableSeats,
  totalSeats,
  selectedSeats,
  paymentType,
  step,
  collapsible = false,
}: TripSummaryProps) {
  const [open, setOpen] = useState(false);
  const status = getCommercialStatus(availableSeats, totalSeats);

  const totalAmount = selectedSeats.length * excursion.seat_price_cents;
  const payAmount = paymentType === "TOTAL" ? totalAmount : Math.round(totalAmount * 0.5);
  const pendingAmount = totalAmount - payAmount;

  const depDate = new Date(excursion.departure_at);
  const dateStr = depDate.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = depDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const occupancyPct = Math.round(((totalSeats - availableSeats) / totalSeats) * 100);

  const content = (
    <div className="space-y-4">
      {/* Trip name + status */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-base leading-tight">{excursion.name}</h3>
          <Badge className={cn("shrink-0 text-[10px] uppercase tracking-wider border font-semibold", status.cls)}>
            {status.label}
          </Badge>
        </div>

        {/* Occupancy bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{availableSeats} vagas restantes</span>
            <span>{occupancyPct}% ocupado</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                occupancyPct >= 85 ? "bg-destructive" : occupancyPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Details */}
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
            <MapPin className="h-3.5 w-3.5 text-primary" />
          </div>
          <span>{excursion.destination}{excursion.destination_state ? ` / ${excursion.destination_state}` : ""}</span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
            <Calendar className="h-3.5 w-3.5 text-primary" />
          </div>
          <span>{dateStr} às {timeStr}</span>
        </div>
        {excursion.boarding_location && (
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Bus className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>{excursion.boarding_location}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Pricing */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Preço por assento</span>
          <span className="font-semibold">{formatCurrency(excursion.seat_price_cents)}</span>
        </div>

        {selectedSeats.length > 0 ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Assentos</span>
              <span className="font-mono text-xs font-medium">{[...selectedSeats].sort((a, b) => a - b).join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantidade</span>
              <span className="font-medium">{selectedSeats.length}×</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">Total</span>
              <span className="font-bold text-lg text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            {step !== "info" && step !== "seats" && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {paymentType === "TOTAL" ? "Pagamento integral" : "Entrada (50%)"}
                  </span>
                  <span className="font-bold text-primary">{formatCurrency(payAmount)}</span>
                </div>
                {paymentType === "PARCIAL" && pendingAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo pendente</span>
                    <span className="text-amber-600 font-medium">{formatCurrency(pendingAmount)}</span>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-2">
            <Users className="h-3.5 w-3.5" />
            Selecione assentos para ver o resumo.
          </div>
        )}
      </div>

      {excursion.pix_expiration_minutes && step !== "info" && step !== "seats" && (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Clock className="h-3 w-3 shrink-0" />
            <span>PIX expira em {excursion.pix_expiration_minutes} min após geração</span>
          </div>
        </>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-4 py-3 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bus className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-sm">{excursion.name}</span>
              {selectedSeats.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  · {selectedSeats.length} assento(s)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedSeats.length > 0 && (
              <span className="font-bold text-sm text-primary">{formatCurrency(totalAmount)}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform text-muted-foreground", open && "rotate-180")} />
          </div>
        </button>
        {open && <div className="px-4 pb-4 border-t border-border/50">{content}</div>}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-5 sticky top-20 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Resumo da viagem
        </p>
      </div>
      {content}
    </div>
  );
}
