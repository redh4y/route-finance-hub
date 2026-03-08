import { Bus, Phone, Mail, MapPin, MessageCircle, ArrowUpRight } from "lucide-react";
import {
  TAVARES_ADDRESS,
  TAVARES_WHATSAPP_E164,
  TAVARES_EMAIL,
  TAVARES_PHONE_DISPLAY,
  TAVARES_WHATSAPP_URL,
} from "@/lib/contact";
import { trackPublicEvent } from "@/lib/publicMarketing";

interface Props {
  contact: any;
}

export function LandingFooter({ contact }: Props) {
  const c = contact || {};
  const whatsappDigits = String(c.whatsapp || TAVARES_WHATSAPP_E164).replace(/\D/g, "");
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : TAVARES_WHATSAPP_URL;
  const phone = c.phone || TAVARES_PHONE_DISPLAY;
  const email = c.email || TAVARES_EMAIL;
  const address = c.address || TAVARES_ADDRESS;

  const footerLinks = [
    { label: "Excursões", href: "#excursoes" },
    { label: "Serviços", href: "#servicos" },
    { label: "Frota", href: "#frota" },
    { label: "Contato", href: "#contato" },
  ];

  return (
    <footer id="contato" className="bg-[hsl(222,47%,6%)] text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-16 sm:py-20 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white leading-none">Tavares</span>
                <span className="block text-[10px] font-semibold text-white/40 leading-none mt-0.5 tracking-widest">TRANSPORTES</span>
              </div>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-[280px]">
              Transporte com segurança e pontualidade para excursões, eventos e universitários.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-xs uppercase tracking-widest">Contato</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <a href={`tel:${phone.replace(/\D/g, "")}`} className="flex items-center gap-3 hover:text-white transition-colors group">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 group-hover:bg-emerald-500/20 transition-colors">
                    <Phone className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span>{phone}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`} className="flex items-center gap-3 hover:text-white transition-colors group">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 group-hover:bg-emerald-500/20 transition-colors">
                    <Mail className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="truncate">{email}</span>
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                </div>
                <span>{address}</span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-xs uppercase tracking-widest">Links Úteis</h4>
            <ul className="space-y-3 text-sm">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex items-center gap-2 hover:text-white transition-colors group"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* WhatsApp CTA */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-xs uppercase tracking-widest">Fale Conosco</h4>
            <p className="text-sm text-white/40 mb-4 leading-relaxed">
              Atendimento rápido pelo WhatsApp em horário comercial.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPublicEvent("whatsapp_click", { source_page: "/site" })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/25">
          <p>© {new Date().getFullYear()} Tavares Transportes. Todos os direitos reservados.</p>
          <p>{address}</p>
        </div>
      </div>
    </footer>
  );
}
