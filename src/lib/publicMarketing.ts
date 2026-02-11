import { supabase } from "@/integrations/supabase/client";

export type PublicEventName =
  | "view_site"
  | "click_excursion"
  | "start_checkout"
  | "whatsapp_click"
  | "lead_submitted";

type UtmData = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  affiliate_ref?: string | null;
};

const SESSION_KEY = "public_marketing_sid";

function getSessionId() {
  const fromStorage = window.localStorage.getItem(SESSION_KEY);
  if (fromStorage) return fromStorage;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function getUtmData(): UtmData {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
    affiliate_ref: params.get("ref"),
  };
}

export async function trackPublicEvent(
  eventName: PublicEventName,
  options?: {
    source_page?: string;
    excursion_id?: string | null;
    public_token?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const utm = getUtmData();
  await (supabase as any).from("public_tracking_events").insert({
    event_name: eventName,
    source_page: options?.source_page || window.location.pathname,
    excursion_id: options?.excursion_id || null,
    public_token: options?.public_token || null,
    metadata: {
      ...(options?.metadata || {}),
      session_id: getSessionId(),
    },
    ...utm,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
  });
}

export async function submitPublicLead(input: {
  name: string;
  phone: string;
  interest_type?: string;
  message?: string;
  source_page?: string;
}) {
  const utm = getUtmData();
  const payload = {
    source_page: input.source_page || window.location.pathname,
    name: input.name,
    phone: input.phone,
    interest_type: input.interest_type || null,
    message: input.message || null,
    ...utm,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
  };
  const { error } = await (supabase as any).from("public_leads").insert(payload);
  if (error) throw error;
  await trackPublicEvent("lead_submitted", {
    source_page: payload.source_page,
    metadata: { interest_type: payload.interest_type || undefined },
  });
}

export function openWhatsAppTracked(url: string, sourcePage?: string) {
  trackPublicEvent("whatsapp_click", { source_page: sourcePage }).finally(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  });
}

