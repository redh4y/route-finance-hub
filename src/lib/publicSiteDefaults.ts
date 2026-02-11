export type PublicServiceItem = {
  title: string;
  description: string;
};

export type PublicFleetItem = {
  title: string;
  description: string;
  icon: "van" | "micro" | "bus";
};

export type PublicTestimonial = {
  name: string;
  role: string;
  text: string;
};

export type PublicSiteContent = {
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  whatsappUrl: string;
  budgetUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImageUrl: string;
  showServices: boolean;
  showFleet: boolean;
  showDifferentials: boolean;
  showTrust: boolean;
  showFinalCta: boolean;
  services: PublicServiceItem[];
  fleet: PublicFleetItem[];
  differentials: string[];
  testimonials: PublicTestimonial[];
  trustYears: string;
  trustClients: string;
  trustTrips: string;
  finalCtaTitle: string;
  finalCtaSubtitle: string;
};

export const defaultPublicSiteContent: PublicSiteContent = {
  metaTitle: "Tavares Transportes | Excursões e Transporte para Eventos",
  metaDescription:
    "Excursões, transporte universitario, eventos e casamentos com seguranca, pontualidade e atendimento agil.",
  ogImageUrl:
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1400&q=80",
  whatsappUrl: TAVARES_WHATSAPP_URL,
  budgetUrl: `${TAVARES_WHATSAPP_URL}?text=Ol%C3%A1%2C+quero+um+orcamento+de+transporte`,
  contactPhone: TAVARES_PHONE_DISPLAY,
  contactEmail: "tavarestransportes017@gmail.com",
  contactAddress: "Guaíra - SP",
  heroBadge: "Transporte profissional para grupos",
  heroTitle: "Excursões e transporte de eventos com venda online de vagas",
  heroSubtitle:
    "Planejamento, conforto e seguranca para sua viagem. Escolha sua excursao e reserve sua vaga com checkout PIX.",
  heroPrimaryCta: "Ver Excursoes Disponiveis",
  heroSecondaryCta: "Solicitar Orcamento",
  heroImageUrl:
    "https://images.unsplash.com/photo-1570125909517-53cb21c89ff2?auto=format&fit=crop&w=1400&q=80",
  showServices: true,
  showFleet: true,
  showDifferentials: true,
  showTrust: true,
  showFinalCta: true,
  services: [
    {
      title: "Transporte para eventos e casamentos",
      description:
        "Organizacao de deslocamento de convidados com horarios e pontos estrategicos definidos.",
    },
    {
      title: "Excursoes para shows, igrejas e empresas",
      description:
        "Viagens com logistica completa de saida e retorno para grupos de todos os tamanhos.",
    },
    {
      title: "Transporte universitario",
      description:
        "Operacao recorrente com foco em seguranca, pontualidade e previsibilidade para os alunos.",
    },
  ],
  fleet: [
    {
      title: "Vans",
      description: "Ideal para grupos menores e transporte executivo.",
      icon: "van",
    },
    {
      title: "Micro-onibus",
      description: "Equilibrio entre conforto e custo-beneficio.",
      icon: "micro",
    },
    {
      title: "Onibus",
      description: "Melhor opcao para grandes grupos com alta organizacao.",
      icon: "bus",
    },
  ],
  differentials: [
    "Veiculos revisados",
    "Motoristas habilitados e experientes",
    "Compromisso com seguranca",
    "Atendimento agil e personalizado",
    "Organizacao previa de horarios e pontos estrategicos",
  ],
  testimonials: [
    {
      name: "Ana Ribeiro",
      role: "Organizadora de eventos",
      text: "Equipe pontual e organizada. O transporte dos convidados ocorreu sem atrasos.",
    },
    {
      name: "Carlos Mendes",
      role: "Coordenador de excursao",
      text: "Atendimento rapido e operacao segura do inicio ao fim da viagem.",
    },
  ],
  trustYears: "10+ anos",
  trustClients: "3.500+ passageiros",
  trustTrips: "1.200+ viagens",
  finalCtaTitle:
    "Organize seu evento sem dor de cabeca. Nos cuidamos do deslocamento com seguranca e pontualidade.",
  finalCtaSubtitle:
    "Solicite um orcamento em minutos e receba uma proposta ajustada para o seu grupo.",
};

import { TAVARES_PHONE_DISPLAY, TAVARES_WHATSAPP_URL } from "./contact";
