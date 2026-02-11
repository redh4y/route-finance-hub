import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight, AlertTriangle } from "lucide-react";
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

export function LandingExcursions({ excursions, isLoading }: Props) {
  const navigate = useNavigate();
  const ordered = [...(excursions || [])].sort(
    (a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime()
  );
  const featured = ordered.find((x) => x.commercialStatus !== "sold_out") || ordered[0];
  const rest = ordered.filter((x) => x.id !== featured?.id);

  const formatDateBR = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <section id="excursoes" className="py-16 sm:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Excursoes Disponiveis</h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Confira nossas proximas viagens e garanta sua vaga com facilidade
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="h-3 w-full" />
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
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-16"
          >
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma excursao disponivel no momento</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Novas viagens serao publicadas em breve!</p>
          </motion.div>
        ) : (
          <>
            {featured && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-7"
              >
                <Card className="relative overflow-hidden border-0 shadow-xl shadow-primary/15">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-emerald-500/10 to-amber-500/10" />
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary to-emerald-500" />
                  <CardContent className="relative p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className="bg-primary text-primary-foreground border-primary/40 font-semibold">
                        Proxima saida
                      </Badge>
                      {featured.commercialStatus === "last_seats" && (
                        <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 font-semibold">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Ultimas vagas
                        </Badge>
                      )}
                    </div>
                    <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
                      <div>
                        <h3 className="text-2xl font-extrabold tracking-tight">{featured.name}</h3>
                        <p className="text-muted-foreground">
                          {featured.destination}
                          {featured.destination_state ? ` - ${featured.destination_state}` : ""}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2.5 text-sm">
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-muted-foreground">
                            <Calendar className="h-4 w-4 text-primary shrink-0" />
                            {formatDateBR(featured.departure_at)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-muted-foreground">
                            <Clock className="h-4 w-4 text-primary shrink-0" />
                            {formatTime(featured.departure_at)}
                          </span>
                          {featured.boarding_location && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-muted-foreground">
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              {featured.boarding_location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="md:text-right rounded-xl border bg-background/80 px-4 py-3">
                        <p className="text-xs text-muted-foreground">A partir de</p>
                        <p className="text-3xl font-extrabold text-primary">{formatCurrency(featured.seat_price_cents)}</p>
                        <Button
                          className="mt-3 w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-600/25"
                          onClick={async () => {
                            if (!featured.public_token) return;
                            await trackPublicEvent("click_excursion", {
                              source_page: "/site",
                              excursion_id: featured.id,
                              public_token: featured.public_token,
                              metadata: { origin: "featured_card" },
                            });
                            await trackPublicEvent("start_checkout", {
                              source_page: "/site",
                              excursion_id: featured.id,
                              public_token: featured.public_token,
                            });
                            navigate(`/public/excursoes/${featured.public_token}`);
                          }}
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

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((exc, i) => (
                <motion.div
                  key={exc.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/60 h-full flex flex-col">
                    <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-emerald-500" />

                    <CardContent className="p-5 sm:p-6 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground leading-tight truncate">{exc.name}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {exc.destination}
                            {exc.destination_state ? ` - ${exc.destination_state}` : ""}
                          </p>
                        </div>
                        {exc.commercialStatus === "last_seats" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Ultimas vagas
                          </Badge>
                        )}
                        {exc.commercialStatus === "available" && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0 text-xs">
                            Disponivel
                          </Badge>
                        )}
                        {exc.commercialStatus === "sold_out" && (
                          <Badge variant="destructive" className="shrink-0 text-xs">
                            Encerrada
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2.5 text-sm text-muted-foreground flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary shrink-0" />
                          <span>{formatDateBR(exc.departure_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <span>Saida as {formatTime(exc.departure_at)}</span>
                        </div>
                        {exc.boarding_location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate">{exc.boarding_location}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-border/50">
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            <span className="text-xs text-muted-foreground">A partir de</span>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(exc.seat_price_cents)}</p>
                          </div>
                        </div>
                        {exc.commercialStatus === "sold_out" ? (
                          <Button className="w-full font-semibold h-11" variant="outline" disabled>
                            Encerrada
                          </Button>
                        ) : (
                          <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                            onClick={() => {
                              if (!exc.public_token) return;
                              trackPublicEvent("click_excursion", {
                                source_page: "/site",
                                excursion_id: exc.id,
                                public_token: exc.public_token,
                                metadata: { origin: "grid_card" },
                              });
                              trackPublicEvent("start_checkout", {
                                source_page: "/site",
                                excursion_id: exc.id,
                                public_token: exc.public_token,
                              });
                              navigate(`/public/excursoes/${exc.public_token}`);
                            }}
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

