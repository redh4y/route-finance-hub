import { useState, useEffect } from "react";
import { Bus, Menu, X, MessageCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { openWhatsAppTracked } from "@/lib/publicMarketing";

interface Props {
  whatsappUrl: string;
}

const navLinks = [
  { label: "Início", href: "#inicio" },
  { label: "Excursões", href: "#excursoes" },
  { label: "Serviços", href: "#servicos" },
  { label: "Frota", href: "#frota" },
  { label: "Contato", href: "#contato" },
];

export function LandingHeader({ whatsappUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <button onClick={() => scrollTo("#inicio")} className="flex items-center gap-2.5 group">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
              scrolled ? "bg-primary shadow-md" : "bg-white/15 backdrop-blur-sm border border-white/20"
            )}>
              <Bus className={cn("h-5 w-5 transition-colors", scrolled ? "text-primary-foreground" : "text-white")} />
            </div>
            <div>
              <span className={cn(
                "text-lg font-bold leading-none transition-colors",
                scrolled ? "text-foreground" : "text-white"
              )}>
                Tavares
              </span>
              <span className={cn(
                "block text-[10px] font-semibold leading-none mt-0.5 tracking-widest transition-colors",
                scrolled ? "text-muted-foreground" : "text-white/60"
              )}>
                TRANSPORTES
              </span>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={cn(
                  "px-3.5 py-2 text-sm font-medium transition-colors rounded-lg",
                  scrolled
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                )}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              size="sm"
              variant={scrolled ? "outline" : "ghost"}
              className={cn(
                !scrolled && "border-white/25 text-white hover:bg-white/10 hover:text-white"
              )}
              onClick={() => scrollTo("#excursoes")}
            >
              Ver Excursões
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              onClick={() => openWhatsAppTracked(whatsappUrl, "/site")}
            >
              <MessageCircle className="h-4 w-4 mr-1.5" />
              WhatsApp
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              scrolled ? "hover:bg-muted text-foreground" : "hover:bg-white/10 text-white"
            )}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="flex items-center justify-between w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => scrollTo("#excursoes")}>
                  Ver Excursões
                </Button>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setOpen(false);
                    openWhatsAppTracked(whatsappUrl, "/site");
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  Falar no WhatsApp
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
