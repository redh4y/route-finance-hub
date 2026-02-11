import { MapPin, Calendar, Bus, Clock, ChevronDown } from "lucide-react";
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
  if (available === 0) return { label: "Encerrada", variant: "destructive" as const };
  if (available <= Math.ceil(total * 0.15)) return { label: "Últimas vagas", variant: "secondary" as const };
  return { label: "Disponível", variant: "default" as const };
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

  const content = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-base leading-tight">{excursion.name}</h3>
        <Badge
          variant={status.variant}
          className={cn(
            "shrink-0 text-[10px] uppercase tracking-wider",
            status.label === "Últimas vagas" && "bg-warning/15 text-warning border-warning/30",
            status.label === "Encerrada" && "bg-destructive/15 text-destructive border-destructive/30",
            status.label === "Disponível" && "bg-success/15 text-success border-success/30"
          )}
        >
          {status.label}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{excursion.destination}{excursion.destination_state ? `/${excursion.destination_state}` : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{dateStr} às {timeStr}</span>
        </div>
        {excursion.boarding_location && (
          <div className="flex items-center gap-2">
            <Bus className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{excursion.boarding_location}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Preço por assento</span>
          <span className="font-semibold">{formatCurrency(excursion.seat_price_cents)}</span>
        </div>

        {selectedSeats.length > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Assentos</span>
              <span className="font-medium">{selectedSeats.sort((a, b) => a - b).join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantidade</span>
              <span className="font-medium">{selectedSeats.length}x</span>
            </div>

            <Separator />

            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
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
                    <span className="text-warning font-medium">{formatCurrency(pendingAmount)}</span>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {selectedSeats.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Selecione assentos para ver o resumo do pedido.
          </p>
        )}
      </div>

      {excursion.pix_expiration_minutes && step !== "info" && step !== "seats" && (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>PIX expira em {excursion.pix_expiration_minutes} min após geração</span>
          </div>
        </>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-4 py-3 text-left"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Resumo da viagem</span>
            {selectedSeats.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {selectedSeats.length} assento(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedSeats.length > 0 && (
              <span className="font-bold text-sm text-primary">{formatCurrency(totalAmount)}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </div>
        </button>
        {open && <div className="px-4 pb-4">{content}</div>}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-5 sticky top-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Resumo da viagem
      </p>
      {content}
    </div>
  );
}
