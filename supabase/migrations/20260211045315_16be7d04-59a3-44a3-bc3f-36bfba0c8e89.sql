
CREATE TABLE public.landing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landing settings viewable by all" ON public.landing_settings FOR SELECT USING (true);
CREATE POLICY "Landing settings insertable by all" ON public.landing_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Landing settings updatable by all" ON public.landing_settings FOR UPDATE USING (true);
CREATE POLICY "Landing settings deletable by all" ON public.landing_settings FOR DELETE USING (true);

INSERT INTO public.landing_settings (section, content) VALUES
('hero', '{"badge":"🚌 Tavares Transportes","headline":"Seu transporte com segurança e pontualidade","subheadline":"Excursões, eventos e transporte universitário com frota própria e motoristas experientes.","cta_primary":"Ver Excursões Disponíveis","cta_secondary":"Solicitar Orçamento"}'),
('services', '{"items":[{"icon":"PartyPopper","title":"Eventos e Casamentos","description":"Transporte organizado para seus convidados com pontualidade e conforto."},{"icon":"Music","title":"Shows e Excursões","description":"Viagens para shows, igrejas e empresas com preços acessíveis."},{"icon":"MapPin","title":"Logística Completa","description":"Planejamento de rotas, pontos de embarque e horários otimizados."},{"icon":"Shield","title":"Segurança Total","description":"Veículos revisados, motoristas habilitados e seguro de viagem."}]}'),
('fleet', '{"items":[{"emoji":"🚐","name":"Vans","description":"Ideal para grupos menores e transporte executivo. Conforto e agilidade."},{"emoji":"🚎","name":"Micro-ônibus","description":"Equilíbrio perfeito entre conforto e custo-benefício para grupos médios."},{"emoji":"🚌","name":"Ônibus","description":"Para grandes grupos com máxima organização, espaço e segurança."}]}'),
('differentials', '{"items":["Veículos revisados e em dia","Motoristas habilitados e experientes","Compromisso total com segurança","Atendimento ágil e personalizado","Horários e pontos estratégicos planejados"]}'),
('testimonials', '{"items":[{"name":"Maria Silva","text":"Excelente serviço! Pontualidade e conforto em todas as viagens.","role":"Coordenadora de Eventos"},{"name":"João Santos","text":"Contratamos para nosso casamento e foi perfeito. Recomendo!","role":"Cliente"},{"name":"Ana Oliveira","text":"Uso o transporte universitário há 2 anos. Nunca tive problemas.","role":"Estudante"}]}'),
('trust_indicators', '{"items":[{"value":"8+","label":"Anos de atuação"},{"value":"5.000+","label":"Passageiros atendidos"},{"value":"500+","label":"Viagens realizadas"},{"value":"100%","label":"Compromisso"}]}'),
('university', '{"headline":"Transporte Universitário","description":"Rotas regulares para Barretos e Franca com horários flexíveis, pontualidade garantida e preços acessíveis para estudantes.","features":["Rotas regulares Barretos ↔ Franca","Horários compatíveis com grade universitária","Mensalidade acessível","Embarque em pontos estratégicos"],"cta":"Quero transporte universitário"}'),
('contact', '{"whatsapp":"5517999999999","phone":"(17) 99999-9999","email":"contato@tavarestransportes.com.br","address":"Barretos - SP","instagram":"","facebook":""}'),
('seo', '{"title":"Tavares Transportes | Excursões, Eventos e Transporte Universitário","description":"Transporte com segurança e pontualidade para excursões, eventos, casamentos e universitários em Barretos e região.","og_image":""}'),
('cta_final', '{"headline":"Organize seu evento sem dor de cabeça","description":"Nós cuidamos do deslocamento com segurança e pontualidade. Solicite um orçamento sem compromisso.","cta_primary":"Solicitar Orçamento","cta_secondary":"Falar no WhatsApp"}');
