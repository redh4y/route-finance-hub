import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import { usePublicSiteContent } from "@/hooks/usePublicSiteContent";
import {
  ArrowRight,
  Bus,
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  CarFront,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PublicExcursionRow = {
  id: string;
  name: string;
  destination: string;
  destination_state: string | null;
  departure_at: string;
  boarding_location: string | null;
  seat_price_cents: number;
  public_token: string | null;
  public_enabled: boolean;
  status: string;
};

type ExcursionSeatRow = {
  excursion_id: string;
  status: string;
  blocked: boolean;
};

function upsertMetaTag(name: string, content: string, byProperty = false) {
  const selector = byProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (byProperty) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function getAvailabilityLabel(exc: PublicExcursionRow, seats: ExcursionSeatRow[]): {
  label: "Disponivel" | "Ultimas vagas" | "Encerrada";
  tone: "default" | "secondary" | "destructive";
} {
  if (!exc.public_enabled || !exc.public_token || ["CANCELADA", "FINALIZADA"].includes(exc.status)) {
    return { label: "Encerrada", tone: "destructive" };
  }

  const rows = seats.filter((s) => s.excursion_id === exc.id);
  if (rows.length === 0) return { label: "Disponivel", tone: "default" };

  const total = rows.length;
  const available = rows.filter((s) => s.status === "DISPONIVEL" && !s.blocked).length;
  if (available === 0 || exc.status === "LOTADA") return { label: "Encerrada", tone: "destructive" };
  if (available <= Math.max(3, Math.ceil(total * 0.15))) return { label: "Ultimas vagas", tone: "secondary" };
  return { label: "Disponivel", tone: "default" };
}

export default function PublicExcursions() {
  const [search, setSearch] = useState("");
  const { data: siteData } = usePublicSiteContent();
  const content = siteData?.content;

  const { data, isLoading } = useQuery({
    queryKey: ["public-excursions-landing-list"],
    queryFn: async () => {
      const { data: excursions, error } = await supabase
        .from("excursions")
        .select(
          "id, name, destination, destination_state, departure_at, boarding_location, seat_price_cents, public_token, public_enabled, status"
        )
        .eq("public_enabled", true)
        .not("public_token", "is", null)
        .order("departure_at", { ascending: true });
      if (error) throw error;

      const ids = (excursions || []).map((x) => x.id);
      if (ids.length === 0) {
        return {
          excursions: [] as PublicExcursionRow[],
          seats: [] as ExcursionSeatRow[],
        };
      }

      const { data: seatRows, error: seatError } = await supabase
        .from("excursion_seats")
        .select("excursion_id, status, blocked")
        .in("excursion_id", ids);
      if (seatError) throw seatError;

      return {
        excursions: (excursions || []) as PublicExcursionRow[],
        seats: (seatRows || []) as ExcursionSeatRow[],
      };
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.excursions || [];
    return (data?.excursions || []).filter((row) => {
      const target = `${row.name} ${row.destination} ${row.destination_state || ""}`.toLowerCase();
      return target.includes(term);
    });
  }, [data, search]);

  useEffect(() => {
    if (!content) return;
    document.title = content.metaTitle;
    upsertMetaTag("description", content.metaDescription);
    upsertMetaTag("og:title", content.metaTitle, true);
    upsertMetaTag("og:description", content.metaDescription, true);
    upsertMetaTag("og:image", content.ogImageUrl, true);
    upsertMetaTag("og:type", "website", true);
  }, [content]);

  if (!content) {
    return <div className="min-h-screen bg-background" />;
  }

  const heroCtas = (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <a href="#excursoes">{content.heroPrimaryCta}</a>
      </Button>
      <Button asChild variant="outline" size="lg">
        <a href={content.budgetUrl} target="_blank" rel="noopener noreferrer">
          {content.heroSecondaryCta}
        </a>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Bus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold leading-tight">Tavares Transportes</p>
              <p className="text-xs text-muted-foreground">Transporte universitario e excursoes</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-sm">
            <a href="#inicio" className="hover:text-primary transition-colors">Inicio</a>
            <a href="#excursoes" className="hover:text-primary transition-colors">Excursoes</a>
            <a href="#servicos" className="hover:text-primary transition-colors">Servicos</a>
            <a href="#frota" className="hover:text-primary transition-colors">Frota</a>
            <a href="#contato" className="hover:text-primary transition-colors">Contato</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="#excursoes">Ver Excursoes</a>
            </Button>
            <Button asChild size="sm">
              <a href={content.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section id="inicio" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 py-10 md:py-16 grid gap-8 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="space-y-5"
            >
              <Badge variant="outline">{content.heroBadge}</Badge>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{content.heroTitle}</h1>
              <p className="text-muted-foreground text-base md:text-lg">{content.heroSubtitle}</p>
              {heroCtas}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden border shadow-sm">
                <img
                  src={content.heroImageUrl}
                  alt="Transporte executivo e excursoes"
                  className="w-full h-[260px] md:h-[360px] object-cover"
                  loading="eager"
                />
              </div>
            </motion.div>
          </div>
        </section>

        <section id="excursoes" className="max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold">Excursoes disponiveis para reserva</h2>
              <p className="text-muted-foreground mt-1">
                Escolha seu destino e reserve sua vaga com checkout PIX.
              </p>
            </div>
            <div className="relative w-full md:w-[320px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar excursao ou destino"
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando excursões...</div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="font-medium">Sem excursões publicas no momento.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Fale com nossa equipe para receber novas datas e destinos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item, index) => {
                const availability = getAvailabilityLabel(item, data?.seats || []);
                const isClosed = availability.label === "Encerrada";
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: index * 0.04 }}
                  >
                    <Card className="h-full">
                      <CardContent className="p-5 flex flex-col h-full">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-semibold leading-tight">{item.name}</h3>
                          <Badge variant={availability.tone}>{availability.label}</Badge>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span>
                              {item.destination}
                              {item.destination_state ? `/${item.destination_state}` : ""}
                            </span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            {new Date(item.departure_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 shrink-0" />
                            {new Date(item.departure_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {item.boarding_location ? (
                            <p className="line-clamp-2">Saida: {item.boarding_location}</p>
                          ) : null}
                        </div>

                        <Separator className="my-4" />
                        <p className="text-xs text-muted-foreground">Preco inicial</p>
                        <p className="text-2xl font-bold mb-4">{formatCurrency(item.seat_price_cents)}</p>

                        <div className="mt-auto">
                          {isClosed ? (
                            <Button className="w-full" variant="outline" disabled>
                              Encerrada
                            </Button>
                          ) : (
                            <Button className="w-full gap-2" asChild>
                              <Link to={`/public/excursoes/${item.public_token}`}>
                                Reservar vaga
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {content.showServices && (
          <section id="servicos" className="bg-muted/40 border-y border-border">
            <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
              <h2 className="text-2xl md:text-3xl font-semibold mb-6">Servicos</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {content.services.map((item) => (
                  <Card key={item.title}>
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {content.showFleet && (
          <section id="frota" className="max-w-7xl mx-auto px-4 py-10 md:py-14">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">Frota adaptada ao seu evento</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {content.fleet.map((item) => (
                <Card key={item.title}>
                  <CardContent className="p-5">
                    <div className="mb-3 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {item.icon === "van" ? (
                        <CarFront className="h-5 w-5" />
                      ) : item.icon === "micro" ? (
                        <Bus className="h-5 w-5" />
                      ) : (
                        <Bus className="h-5 w-5" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {content.showDifferentials && (
          <section className="bg-muted/40 border-y border-border">
            <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
              <h2 className="text-2xl md:text-3xl font-semibold mb-6">Diferenciais</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {content.differentials.map((text) => (
                  <div key={text} className="flex items-start gap-2 rounded-lg border bg-card p-4">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <p className="text-sm">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {content.showTrust && (
          <section className="max-w-7xl mx-auto px-4 py-10 md:py-14">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">Confianca e resultado</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[content.trustYears, content.trustClients, content.trustTrips].map((value) => (
                <Card key={value}>
                  <CardContent className="p-5">
                    <p className="text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {content.testimonials.map((item) => (
                <Card key={`${item.name}-${item.role}`}>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground mb-3">"{item.text}"</p>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {content.showFinalCta && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <div className="rounded-2xl border bg-card p-6 md:p-8">
              <div className="grid md:grid-cols-[1fr_auto] gap-5 items-center">
                <div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-2">{content.finalCtaTitle}</h3>
                  <p className="text-muted-foreground">{content.finalCtaSubtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={content.budgetUrl} target="_blank" rel="noopener noreferrer">
                      Solicitar orcamento
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={content.whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer id="contato" className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-semibold mb-2">Tavares Transportes</p>
            <p className="text-muted-foreground">Transporte universitario, eventos e excursoes.</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Contato</p>
            <p className="text-muted-foreground">{content.contactPhone}</p>
            <p className="text-muted-foreground">{content.contactEmail}</p>
            <p className="text-muted-foreground">{content.contactAddress}</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Links</p>
            <div className="space-y-1">
              <a className={cn("block text-muted-foreground hover:text-primary")} href="#excursoes">Excursoes</a>
              <a
                className={cn("block text-muted-foreground hover:text-primary")}
                href={content.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a className={cn("block text-muted-foreground hover:text-primary")} href="#">
                Politica de privacidade
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
