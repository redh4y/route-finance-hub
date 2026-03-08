import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight, AlertTriangle, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { trackPublicEvent } from "@/lib/publicMarketing";

interface ExcursionCard {
  id: string;
  name: string;
  destination: string;
  destination_state: string | null;
  departure_at: string;
  return_at: string | null;
  boarding_location: string | null;
  seat_price_cents: number;
  public_token: string | null;
  commercialStatus: "available" | "last_seats" | "sold_out";
}

interface Props {
  excursions: ExcursionCard[] | undefined;
  isLoading: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5 },
};

export function LandingExcursions({ excursions, isLoading }: Props) {
  const navigate = useNavigate();
  const ordered = [...(excursions || [])].sort(
    (a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime()
  );
  const featured = ordered.find((x) => x.commercialStatus !== "sold_out") || ordered[0];
  const rest = ordered.filter((x) => x.id !== featured?.id);

  const formatDateBR = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const formatDateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const goToExcursion = async (exc: ExcursionCard, origin: string) => {
    if (!exc.public_token) return;
    await trackPublicEvent("click_excursion", {
      source_page: "/site",
      excursion_id: exc.id,
      public_token: exc.public_token,
      metadata: { origin },
    });
    navigate(`/public/excursoes/${exc.public_token}`);
  };

  return (
    <section id="excursoes" className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Excursões Disponíveis
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Confira nossas próximas viagens e garanta sua vaga com facilidade
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="h-2 w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-10 w-full mt-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !ordered.length ? (
          <motion.div {...fadeUp} className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-5">
              <Calendar className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">Nenhuma excursão disponível no momento</p>
            <p className="text-sm text-muted-foreground/60 mt-2">Novas viagens serão publicadas em breve!</p>
          </motion.div>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <motion.div {...fadeUp} className="mb-8">
                <Card className="relative overflow-hidden border-0 shadow-2xl shadow-primary/10">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-emerald-500/5 to-transparent" />
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 to-primary" />
                  <CardContent className="relative p-6 sm:p-8">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold">
                        <Ticket className="h-3 w-3 mr-1" />
                        Próxima saída
                      </Badge>
                      {featured.commercialStatus === "last_seats" && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Últimas vagas
                        </Badge>
                      )}
                    </div>
                    <div className="grid md:grid-cols-[1fr_auto] gap-6 items-end">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{featured.name}</h3>
                        <p className="text-muted-foreground mt-1">
                          {featured.destination}
                          {featured.destination_state ? ` - ${featured.destination_state}` : ""}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
                          <InfoPill icon={Calendar} text={formatDateBR(featured.departure_at)} />
                          <InfoPill icon={Clock} text={formatTime(featured.departure_at)} />
                          {featured.boarding_location && (
                            <InfoPill icon={MapPin} text={featured.boarding_location} />
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-card px-6 py-5 text-center md:text-right shadow-sm">
                        <p className="text-xs text-muted-foreground mb-1">A partir de</p>
                        <p className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight">
                          {formatCurrency(featured.seat_price_cents)}
                        </p>
                        <Button
                          className="mt-4 w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/20 h-11 px-6"
                          onClick={() => goToExcursion(featured, "featured_card")}
                        >
                          Reservar vaga
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((exc, i) => (
                <motion.div
                  key={exc.id}
                  {...fadeUp}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <Card className="overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/40 h-full flex flex-col">
                    <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground leading-tight truncate">{exc.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {exc.destination}
                            {exc.destination_state ? ` - ${exc.destination_state}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={exc.commercialStatus} />
                      </div>

                      <div className="space-y-3 text-sm text-muted-foreground flex-1">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-primary shrink-0" />
                          <span>{formatDateShort(exc.departure_at)}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <span>Saída às {formatTime(exc.departure_at)}</span>
                        </div>
                        {exc.boarding_location && (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate">{exc.boarding_location}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-5 border-t border-border/40">
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            <span className="text-xs text-muted-foreground">A partir de</span>
                            <p className="text-2xl font-extrabold text-foreground tracking-tight">
                              {formatCurrency(exc.seat_price_cents)}
                            </p>
                          </div>
                        </div>
                        {exc.commercialStatus === "sold_out" ? (
                          <Button className="w-full font-semibold h-11" variant="outline" disabled>
                            Encerrada
                          </Button>
                        ) : (
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 shadow-md shadow-emerald-600/15 group-hover:shadow-lg group-hover:shadow-emerald-600/20 transition-all"
                            onClick={() => goToExcursion(exc, "grid_card")}
                          >
                            Reservar vaga
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function InfoPill({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-2 text-sm text-muted-foreground shadow-sm">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "last_seats") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shrink-0 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Últimas vagas
      </Badge>
    );
  }
  if (status === "available") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0 text-xs">
        Disponível
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="shrink-0 text-xs">
      Encerrada
    </Badge>
  );
}
