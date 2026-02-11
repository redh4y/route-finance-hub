import { Bus, Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import {
  TAVARES_ADDRESS,
  TAVARES_WHATSAPP_E164,
  TAVARES_EMAIL,
  TAVARES_PHONE_DISPLAY,
  TAVARES_WHATSAPP_URL,
} from "@/lib/contact";

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

  return (
    <footer id="contato" className="bg-[hsl(222,47%,8%)] text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white leading-none">Tavares</span>
                <span className="block text-[10px] font-medium text-white/50 leading-none mt-0.5">TRANSPORTES</span>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Transporte com segurança e pontualidade para excursões, eventos e universitários.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contato</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>{phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-500 shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-white transition-colors">{email}</a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>{address}</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Links Úteis</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#excursoes" className="hover:text-white transition-colors">Excursões</a></li>
              <li><a href="#servicos" className="hover:text-white transition-colors">Serviços</a></li>
              <li><a href="#frota" className="hover:text-white transition-colors">Frota</a></li>
            </ul>
          </div>

          {/* WhatsApp */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Fale Conosco</h4>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Tavares Transportes. Todos os direitos reservados.</p>
          <p>{address}</p>
        </div>
      </div>
    </footer>
  );
}
