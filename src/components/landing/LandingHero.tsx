import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Shield, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import heroImage from "@/assets/landing-hero.jpg";

interface Props {
  content: any;
  budgetUrl: string;
  onLeadSubmit?: (data: { name: string; phone: string; interest_type: string }) => Promise<void>;
}

const trustItems = [
  { icon: Shield, label: "Frota própria e segura" },
  { icon: Clock, label: "Pontualidade garantida" },
  { icon: Users, label: "+10 mil passageiros" },
];

export function LandingHero({ content, budgetUrl, onLeadSubmit }: Props) {
  const c = content || {};
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("EXCURSAO");
  const [savingLead, setSavingLead] = useState(false);

  const submitLead = async () => {
    if (!onLeadSubmit) return;
    if (!name.trim() || !phone.trim()) return;
    setSavingLead(true);
    try {
      await onLeadSubmit({ name: name.trim(), phone: phone.trim(), interest_type: interest });
      setName("");
      setPhone("");
      setInterest("EXCURSAO");
    } finally {
      setSavingLead(false);
    }
  };

  return (
    <section id="inicio" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Tavares Transportes"
          className="w-full h-full object-cover scale-105"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(222,47%,8%)]/80 via-[hsl(222,47%,11%)]/75 to-[hsl(222,47%,11%)]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222,47%,8%)]/60 to-transparent" />
      </div>

      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 lg:py-40">
        <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Badge */}
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 backdrop-blur-sm text-emerald-300 text-sm font-medium border border-emerald-500/20 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {c.badge || "Tavares Transportes"}
            </motion.span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
              {c.headline || (
                <>
                  Seu transporte com{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
                    segurança
                  </span>{" "}
                  e pontualidade
                </>
              )}
            </h1>

            <p className="text-lg sm:text-xl text-white/70 leading-relaxed mb-8 max-w-xl">
              {c.subheadline || "Excursões, eventos e transporte universitário com frota própria e motoristas experientes."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold px-8 h-13 shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all"
                onClick={() => document.querySelector("#excursoes")?.scrollIntoView({ behavior: "smooth" })}
              >
                {c.cta_primary || "Ver Excursões Disponíveis"}
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="border border-white/20 !bg-white/5 !text-white hover:!bg-white/10 hover:!text-white text-base h-13 backdrop-blur-sm"
                onClick={() => window.open(budgetUrl, "_blank", "noopener,noreferrer")}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                {c.cta_secondary || "Solicitar Orçamento"}
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6">
              {trustItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-2 text-white/50"
                >
                  <item.icon className="h-4 w-4 text-emerald-400/70" />
                  <span className="text-sm">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right - Lead form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="hidden lg:block"
          >
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
              <div className="text-center mb-5">
                <h3 className="text-white font-bold text-lg">Receba atendimento rápido</h3>
                <p className="text-white/50 text-sm mt-1">Preencha e entraremos em contato</p>
              </div>
              <div className="space-y-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-white/90 border-white/20 text-foreground placeholder:text-muted-foreground h-11"
                />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="WhatsApp (com DDD)"
                  className="bg-white/90 border-white/20 text-foreground placeholder:text-muted-foreground h-11"
                />
                <select
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className="w-full h-11 rounded-md border border-white/20 bg-white/90 px-3 text-sm text-foreground"
                >
                  <option value="EXCURSAO">Excursão</option>
                  <option value="UNIVERSITARIO">Universitário</option>
                  <option value="EVENTO">Evento / Casamento</option>
                </select>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 shadow-lg shadow-emerald-600/25"
                  onClick={submitLead}
                  disabled={savingLead || !name.trim() || !phone.trim()}
                >
                  {savingLead ? "Enviando..." : "Quero receber contato"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <p className="text-white/30 text-[11px] text-center mt-3">
                Sem spam. Resposta em até 1h em horário comercial.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Mobile lead form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:hidden mt-10"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
            <p className="text-white text-sm font-semibold mb-3">Receba atendimento rápido</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="bg-white/90 text-foreground placeholder:text-muted-foreground"
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="WhatsApp"
                className="bg-white/90 text-foreground placeholder:text-muted-foreground"
              />
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                onClick={submitLead}
                disabled={savingLead || !name.trim() || !phone.trim()}
              >
                {savingLead ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 80L48 72C96 64 192 48 288 40C384 32 480 32 576 37.3C672 42.7 768 53.3 864 56C960 58.7 1056 53.3 1152 48C1248 42.7 1344 37.3 1392 34.7L1440 32V80H0Z" fill="hsl(var(--background))" />
        </svg>
      </div>
    </section>
  );
}
