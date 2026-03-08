import { motion } from "framer-motion";
import {
  PartyPopper, Music, MapPin, Shield, CheckCircle2, GraduationCap,
  ArrowRight, MessageCircle, Sparkles, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { openWhatsAppTracked } from "@/lib/publicMarketing";

const iconMap: Record<string, any> = { PartyPopper, Music, MapPin, Shield };

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5 },
};

/* ─── Section Header ─── */
function SectionHeader({ title, subtitle, light }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <motion.div {...fadeUp} className="text-center mb-14">
      <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 ${light ? "text-white" : "text-foreground"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-base sm:text-lg max-w-2xl mx-auto ${light ? "text-white/60" : "text-muted-foreground"}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/* ─── Services ─── */
export function LandingServices({ content }: { content: any }) {
  const items = content?.items || [];
  return (
    <section id="servicos" className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Nossos Serviços"
          subtitle="Soluções completas de transporte para cada necessidade"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item: any, i: number) => {
            const Icon = iconMap[item.icon] || Shield;
            return (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08, duration: 0.5 }}>
                <Card className="h-full text-center border-border/40 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
                  <CardContent className="p-7">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground mb-2 text-lg">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
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
    <section id="frota" className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Frota Adaptada ao Seu Evento"
          subtitle="Veículos ideais para cada tamanho de grupo"
        />
        <div className="grid gap-6 sm:grid-cols-3">
          {items.map((item: any, i: number) => (
            <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.12, duration: 0.5 }}>
              <Card className="h-full border-border/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden group">
                <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-emerald-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-8 text-center">
                  <span className="text-6xl mb-5 block group-hover:scale-110 transition-transform duration-300">{item.emoji}</span>
                  <h3 className="text-xl font-bold text-foreground mb-3">{item.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
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
    <section className="py-20 sm:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Por que escolher a Tavares?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {items.map((item, i) => (
            <motion.div
              key={i}
              {...fadeUp}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="flex items-center gap-4 p-5 bg-card rounded-xl border border-border/40 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
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
    <section className="py-20 sm:py-28 bg-gradient-to-br from-[hsl(222,47%,15%)] via-primary to-[hsl(222,47%,18%)] text-white relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-sm font-medium border border-emerald-500/20 mb-6">
              <GraduationCap className="h-4 w-4" />
              Transporte Universitário
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5 leading-tight tracking-tight">
              {c.headline || "Transporte Universitário"}
            </h2>
            <p className="text-white/60 text-lg mb-8 leading-relaxed max-w-lg">
              {c.description || "Rotas regulares para Barretos e Franca com conforto e segurança."}
            </p>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-13 px-8 shadow-xl shadow-emerald-600/25"
              onClick={() => openWhatsAppTracked(whatsappUrl, "/site")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {c.cta || "Quero transporte universitário"}
            </Button>
          </motion.div>
          <motion.div {...fadeUp} transition={{ delay: 0.15, duration: 0.5 }}>
            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-center gap-4 p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="font-medium text-white/90">{f}</span>
                </motion.div>
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
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Indicators */}
        {iItems.length > 0 && (
          <motion.div {...fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-20">
            {iItems.map((ind: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8 rounded-2xl bg-gradient-to-b from-muted/50 to-muted/20 border border-border/40"
              >
                <p className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-primary to-accent">
                  {ind.value}
                </p>
                <p className="text-sm font-medium text-muted-foreground mt-2">{ind.label}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Testimonials */}
        {tItems.length > 0 && (
          <>
            <SectionHeader title="O que dizem nossos clientes" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tItems.map((t: any, i: number) => (
                <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08, duration: 0.5 }}>
                  <Card className="h-full border-border/40 hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-7">
                      <div className="flex gap-0.5 mb-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed mb-5 italic">&ldquo;{t.text}&rdquo;</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold text-sm">
                          {t.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.role}</p>
                        </div>
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
    <section className="py-20 sm:py-28 bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,15%)] to-[hsl(222,47%,11%)] text-white relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div {...fadeUp}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-sm font-medium border border-emerald-500/20 mb-6">
            <Sparkles className="h-4 w-4" />
            Comece agora
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5 tracking-tight">
            {c.headline || "Organize seu evento sem dor de cabeça"}
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            {c.description || "Nós cuidamos do deslocamento com segurança e pontualidade. Peça seu orçamento sem compromisso."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-13 px-10 shadow-xl shadow-emerald-600/25"
              onClick={() => window.open(budgetUrl, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {c.cta_primary || "Solicitar Orçamento"}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/15 !bg-white/5 !text-white hover:!bg-white/10 hover:!text-white h-13 px-10"
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
