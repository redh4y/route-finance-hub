import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";

const faqs = [
  {
    q: "Como confirmar presença?",
    a: "Ao chegar perto do ônibus, o app detecta sua localização automaticamente. Quando estiver na área de embarque, toque em \"Confirmar Presença\". Pronto!",
  },
  {
    q: "O que fazer se o GPS falhar?",
    a: "Se a localização não for detectada ou estiver imprecisa, use a opção \"Escanear QR Code do ônibus\". Aponte a câmera para o QR Code colado no ônibus.",
  },
  {
    q: "Como usar o QR Code?",
    a: "Na tela de check-in, toque em \"Escanear QR Code do ônibus\". A câmera abrirá automaticamente. Aponte para o QR Code e a presença será registrada.",
  },
  {
    q: "O que significa cada status?",
    a: "Pendente = presença ainda não confirmada. Confirmada = presença registrada com sucesso. Bloqueada = fora do horário ou regra não atendida.",
  },
  {
    q: "Posso ir em um ônibus e voltar em outro?",
    a: "Sim! A ida e a volta são registradas separadamente. Você pode usar ônibus diferentes.",
  },
  {
    q: "Não consigo confirmar presença, o que fazer?",
    a: "Verifique: 1) Se está no horário de embarque. 2) Se está próximo ao ponto. 3) Se já não confirmou essa viagem hoje. Se o problema persistir, procure o coordenador.",
  },
];

export default function StudentHelp() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/presenca")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">Ajuda</h1>
      </header>
      <div className="p-4">
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-card border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
