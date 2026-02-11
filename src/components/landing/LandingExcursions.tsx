import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";

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

  const formatDateBR = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
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
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
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
        ) : !excursions?.length ? (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-16"
          >
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma excursão disponível no momento</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Novas viagens serão publicadas em breve!</p>
          </motion.div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {excursions.map((exc, i) => (
              <motion.div
                key={exc.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/60 h-full flex flex-col">
                  {/* Top accent bar */}
                  <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-emerald-500" />

                  <CardContent className="p-5 sm:p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-foreground leading-tight truncate">
                          {exc.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {exc.destination}{exc.destination_state ? ` - ${exc.destination_state}` : ""}
                        </p>
                      </div>
                      {exc.commercialStatus === "last_seats" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Últimas vagas
                        </Badge>
                      )}
                      {exc.commercialStatus === "available" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0 text-xs">
                          Disponível
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
                        <span>Saída às {formatTime(exc.departure_at)}</span>
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
                        <Button
                          className="w-full font-semibold h-11"
                          variant="outline"
                          disabled
                        >
                          Encerrada
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                          onClick={() => {
                            if (exc.public_token) {
                              navigate(`/public/excursoes/${exc.public_token}`);
                            }
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
        )}
      </div>
    </section>
  );
}
