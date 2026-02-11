# Landing Pública - Checklist de Sugestões

Status baseado no estado atual do projeto.

## 1) Tracking comercial completo
- [ ] Salvar `utm_source`, `utm_medium`, `utm_campaign`, `ref` e `landing_variant` em lead/checkout

## 2) Lead antes da compra
- [ ] Mini formulário no Hero e CTA final (`nome`, `whatsapp`, `tipo de serviço`, `cidade`)
- [ ] Persistência do lead mesmo sem concluir compra

## 3) Tabela de leads dedicada
- [ ] Criar tabela `public_leads`
- [ ] Salvar origem (`source_page`), excursão, afiliado, contato, interesse, mensagem e `utm_*`

## 4) LGPD e confiança
- [ ] Checkbox obrigatório de consentimento
- [ ] Link para política de privacidade no formulário/checkout

## 5) Barretos e Franca no conteúdo
- [ ] Bloco específico de Transporte Universitário com rotas para Barretos e Franca
- [ ] CTA dedicado para transporte universitário

## 6) SEO local
- [ ] Metadados e conteúdo com foco local (ex.: Guaíra, Barretos, Franca)

## 7) Escassez sem expor operação
- [x] Usar status comercial (`Disponível`, `Últimas vagas`, `Encerrada`)
- [x] Não exibir quantidade exata de assentos na vitrine pública

## 8) Imagens e performance
- [ ] Padronizar imagens em `WebP/AVIF`
- [ ] Lazy loading (exceto hero acima da dobra)
- [ ] Fallback de imagem

## 9) Métricas de funil
- [ ] Eventos: `view_excursion_card`, `click_reservar`, `start_checkout`, `pix_generated`, `lead_submitted`, `whatsapp_click`

## 10) Versionamento de conteúdo no admin
- [ ] Registrar histórico de alterações (quem alterou, quando, o que alterou)

