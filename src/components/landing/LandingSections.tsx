import { motion } from "framer-motion";
import { PartyPopper, Music, MapPin, Shield, CheckCircle2, GraduationCap, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { openWhatsAppTracked } from "@/lib/publicMarketing";

const iconMap: Record<string, any> = { PartyPopper, Music, MapPin, Shield };

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

/* ─── Services ─── */
export function LandingServices({ content }: { content: any }) {
  const items = content?.items || [];
  return (
    <section id="servicos" className="py-16 sm:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Nossos Serviços</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Soluções completas de transporte para cada necessidade</p>
        </motion.div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item: any, i: number) => {
            const Icon = iconMap[item.icon] || Shield;
            return (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="h-full text-center border-border/60 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Fleet ─── */
export function LandingFleet({ content }: { content: any }) {
  const items = content?.items || [];
  return (
    <section id="frota" className="py-16 sm:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Frota Adaptada ao Seu Evento</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Veículos ideais para cada tamanho de grupo</p>
        </motion.div>
        <div className="grid gap-6 sm:grid-cols-3">
          {items.map((item: any, i: number) => (
            <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.15 }}>
              <Card className="h-full border-border/60 hover:shadow-md transition-shadow overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="p-6 text-center">
                  <span className="text-5xl mb-4 block">{item.emoji}</span>
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Differentials ─── */
export function LandingDifferentials({ content }: { content: any }) {
  const items: string[] = content?.items || [];
  return (
    <section className="py-16 sm:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">Por que escolher a Tavares?</h2>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {items.map((item, i) => (
            <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/60">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-foreground">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── University ─── */
export function LandingUniversity({ content, whatsappUrl }: { content: any; whatsappUrl: string }) {
  const c = content || {};
  const features: string[] = c.features || [];
  return (
    <section className="py-16 sm:py-24 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sm font-medium mb-5">
              <GraduationCap className="h-4 w-4" />
              {c.headline || "Transporte Universitário"}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight">
              {c.headline || "Transporte Universitário"}
            </h2>
            <p className="text-primary-foreground/80 text-base sm:text-lg mb-8 leading-relaxed">
              {c.description || "Rotas regulares para Barretos e Franca"}
            </p>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 px-8"
              onClick={() => openWhatsAppTracked(whatsappUrl, "/site")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {c.cta || "Quero transporte universitário"}
            </Button>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
            <div className="space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="font-medium">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ─── Trust (Testimonials + Indicators) ─── */
export function LandingTrust({ testimonials, indicators }: { testimonials: any; indicators: any }) {
  const tItems = testimonials?.items || [];
  const iItems = indicators?.items || [];

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Indicators */}
        {iItems.length > 0 && (
          <motion.div {...fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-16">
            {iItems.map((ind: any, i: number) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-muted/50 border border-border/40">
                <p className="text-3xl sm:text-4xl font-extrabold text-primary">{ind.value}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">{ind.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Testimonials */}
        {tItems.length > 0 && (
          <>
            <motion.div {...fadeUp} className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">O que dizem nossos clientes</h2>
            </motion.div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tItems.map((t: any, i: number) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                  <Card className="h-full border-border/60">
                    <CardContent className="p-6">
                      <div className="flex gap-1 mb-4 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg key={s} className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        ))}
                      </div>
                      <p className="text-sm text-foreground mb-4 italic">"{t.text}"</p>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
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

/* ─── CTA Final ─── */
export function LandingCTAFinal({
  content,
  whatsappUrl,
  budgetUrl,
}: {
  content: any;
  whatsappUrl: string;
  budgetUrl: string;
}) {
  const c = content || {};
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-br from-primary via-[hsl(222,47%,15%)] to-primary text-primary-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            {c.headline || "Organize seu evento sem dor de cabeça"}
          </h2>
          <p className="text-primary-foreground/80 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
            {c.description || "Nós cuidamos do deslocamento com segurança e pontualidade."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 px-8"
              onClick={() => window.open(budgetUrl, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {c.cta_primary || "Solicitar Orçamento"}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white h-12 px-8"
              onClick={() => openWhatsAppTracked(whatsappUrl, "/site")}
            >
              {c.cta_secondary || "Falar no WhatsApp"}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
