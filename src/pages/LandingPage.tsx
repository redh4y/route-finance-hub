import { useEffect } from "react";
import { useLandingSettings, usePublicExcursions } from "@/hooks/useLandingSettings";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingExcursions } from "@/components/landing/LandingExcursions";
import {
  LandingServices,
  LandingFleet,
  LandingDifferentials,
  LandingUniversity,
  LandingTrust,
  LandingCTAFinal,
} from "@/components/landing/LandingSections";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TAVARES_BUDGET_TEXT, TAVARES_WHATSAPP_E164, TAVARES_WHATSAPP_URL } from "@/lib/contact";
import { submitPublicLead, trackPublicEvent } from "@/lib/publicMarketing";
import { toast } from "sonner";

export default function LandingPage() {
  const { data: settings } = useLandingSettings();
  const { data: excursions, isLoading: excLoading } = usePublicExcursions();

  const contact = settings?.contact?.content || {};
  const rawWhatsApp = String(
    contact.whatsappUrl ||
      contact.whatsapp_url ||
      contact.whatsapp ||
      TAVARES_WHATSAPP_URL,
  ).trim();

  const whatsappUrl = /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(rawWhatsApp)
    ? rawWhatsApp
    : (() => {
        const digits = rawWhatsApp.replace(/\D/g, "") || TAVARES_WHATSAPP_E164;
        return `https://wa.me/${digits}`;
      })();

  const budgetUrl = `${whatsappUrl}?text=${encodeURIComponent(TAVARES_BUDGET_TEXT)}`;

  const DEFAULT_TITLE = "Tavares Transportes | Excursões, Eventos e Universitário em Guaíra, Barretos e Franca - SP";
  const DEFAULT_DESC = "Tavares Transportes: fretamento para excursões, eventos e transporte universitário em Guaíra, Barretos e Franca. Frota própria, motoristas experientes e pontualidade garantida.";

  // SEO meta tags
  useEffect(() => {
    const seo = settings?.seo?.content || {};
    document.title = seo.title || DEFAULT_TITLE;

    const setMeta = (selector: string, attr: string, value: string) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        const [key, val] = selector.match(/\[(.+?)="(.+?)"\]/)?.slice(1) || [];
        if (key && val) tag.setAttribute(key, val);
        document.head.appendChild(tag);
      }
      tag.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', "content", seo.description || DEFAULT_DESC);

    // OG tags
    const setOg = (property: string, content: string) => {
      setMeta(`meta[property="${property}"]`, "content", content);
    };
    setOg("og:title", seo.title || DEFAULT_TITLE);
    setOg("og:description", seo.description || DEFAULT_DESC);
    if (seo.og_image) setOg("og:image", seo.og_image);

    // JSON-LD structured data
    const existingLd = document.querySelector('script[data-ld="tavares"]');
    if (existingLd) existingLd.remove();

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Tavares Transportes",
      "description": seo.description || DEFAULT_DESC,
      "url": "https://tavarestransp.lovable.app/",
      "telephone": "+5517981606721",
      "email": "tavarestransportes017@gmail.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Guaíra",
        "addressRegion": "SP",
        "addressCountry": "BR"
      },
      "areaServed": [
        { "@type": "City", "name": "Guaíra", "containedInPlace": { "@type": "State", "name": "São Paulo" } },
        { "@type": "City", "name": "Barretos", "containedInPlace": { "@type": "State", "name": "São Paulo" } },
        { "@type": "City", "name": "Franca", "containedInPlace": { "@type": "State", "name": "São Paulo" } }
      ],
      "serviceType": ["Fretamento de ônibus", "Transporte universitário", "Excursões", "Transporte para eventos"],
      "priceRange": "$$"
    };

    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-ld", "tavares");
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    return () => {
      const el = document.querySelector('script[data-ld="tavares"]');
      if (el) el.remove();
    };
  }, [settings]);

  useEffect(() => {
    trackPublicEvent("view_site", { source_page: "/site" });
  }, []);

  const s = (key: string) => settings?.[key];
  const enabled = (key: string) => s(key)?.enabled !== false;

  const handleLeadSubmit = async (lead: { name: string; phone: string; interest_type: string }) => {
    try {
      await submitPublicLead({
        source_page: "/site",
        name: lead.name,
        phone: lead.phone,
        interest_type: lead.interest_type,
      });
      toast.success("Recebemos seus dados. Vamos entrar em contato.");
    } catch (e: any) {
      toast.error(`Não foi possível enviar agora: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader whatsappUrl={whatsappUrl} />

      {enabled("hero") && (
        <LandingHero
          content={s("hero")?.content}
          budgetUrl={budgetUrl}
          onLeadSubmit={handleLeadSubmit}
        />
      )}

      {enabled("university") && s("university")?.content && (
        <LandingUniversity content={s("university")?.content} whatsappUrl={whatsappUrl} />
      )}

      <LandingExcursions excursions={excursions} isLoading={excLoading} />

      {enabled("services") && (
        <LandingServices content={s("services")?.content} />
      )}

      {enabled("fleet") && (
        <LandingFleet content={s("fleet")?.content} />
      )}

      {enabled("differentials") && (
        <LandingDifferentials content={s("differentials")?.content} />
      )}

      {(enabled("testimonials") || enabled("trust_indicators")) && (
        <LandingTrust
          testimonials={enabled("testimonials") ? s("testimonials")?.content : null}
          indicators={enabled("trust_indicators") ? s("trust_indicators")?.content : null}
        />
      )}

      {enabled("cta_final") && (
        <LandingCTAFinal content={s("cta_final")?.content} whatsappUrl={whatsappUrl} budgetUrl={budgetUrl} />
      )}

      <LandingFooter contact={contact} />
    </div>
  );
}
