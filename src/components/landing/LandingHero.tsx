import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/landing-hero.jpg";

interface Props {
  content: any;
  whatsappUrl: string;
}

export function LandingHero({ content, whatsappUrl }: Props) {
  const c = content || {};

  return (
    <section id="inicio" className="relative min-h-[90vh] sm:min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Tavares Transportes"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222,47%,11%)]/90 via-[hsl(222,47%,11%)]/70 to-[hsl(222,47%,11%)]/40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-40">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl"
        >
          {/* Badge */}
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-sm font-medium border border-white/20 mb-6"
          >
            {c.badge || "🚌 Tavares Transportes"}
          </motion.span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight mb-5">
            {c.headline || "Seu transporte com segurança e pontualidade"}
          </h1>

          <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-8 max-w-xl">
            {c.subheadline || "Excursões, eventos e transporte universitário com frota própria e motoristas experientes."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold px-8 h-12 shadow-lg shadow-emerald-600/30"
              onClick={() => document.querySelector("#excursoes")?.scrollIntoView({ behavior: "smooth" })}
            >
              {c.cta_primary || "Ver Excursões Disponíveis"}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white text-base h-12"
              onClick={() => window.open(whatsappUrl, "_blank")}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              {c.cta_secondary || "Solicitar Orçamento"}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Decorative bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full">
          <path d="M0 60L60 50C120 40 240 20 360 13.3C480 6.7 600 13.3 720 23.3C840 33.3 960 46.7 1080 46.7C1200 46.7 1320 33.3 1380 26.7L1440 20V60H0Z" fill="hsl(var(--background))" />
        </svg>
      </div>
    </section>
  );
}
