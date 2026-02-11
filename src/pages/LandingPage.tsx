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

export default function LandingPage() {
  const { data: settings } = useLandingSettings();
  const { data: excursions, isLoading: excLoading } = usePublicExcursions();

  const contact = settings?.contact?.content || {};
  const whatsappUrl = `https://wa.me/${contact.whatsapp || "5517999999999"}`;

  // SEO meta tags
  useEffect(() => {
    if (!settings?.seo?.content) return;
    const seo = settings.seo.content;
    document.title = seo.title || "Tavares Transportes";

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", seo.description || "");

    // OG tags
    const setOg = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setOg("og:title", seo.title || "Tavares Transportes");
    setOg("og:description", seo.description || "");
    if (seo.og_image) setOg("og:image", seo.og_image);
  }, [settings]);

  const s = (key: string) => settings?.[key];
  const enabled = (key: string) => s(key)?.enabled !== false;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader whatsappUrl={whatsappUrl} />

      {enabled("hero") && (
        <LandingHero content={s("hero")?.content} whatsappUrl={whatsappUrl} />
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
        <LandingCTAFinal content={s("cta_final")?.content} whatsappUrl={whatsappUrl} />
      )}

      <LandingFooter contact={contact} />
    </div>
  );
}
