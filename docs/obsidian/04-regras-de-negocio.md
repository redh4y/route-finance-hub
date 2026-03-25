# Regras de Negócio

## Pagadores

**Identificação:**
- O campo `document_digits` (últimos dígitos do CPF) é a chave pública usada no portal de boletos — não o CPF completo. Isso preserva privacidade no canal público.
- O campo `document` armazena o CPF completo (uso interno/admin).

**Status:**
- `ATIVO` — pagador ativo, aparece em listagens e cobranças
- `INATIVO` — desativado; não recebe boletos gerados; não aparece em operações de cobrança
- A mudança de status é registrada em `change_log` (campo JSON com histórico de alterações)

**Revisão:**
- `needs_review = true` indica que o registro precisa ser revisado manualmente (ex: dados conflitantes na importação)
- `review_reason` descreve o motivo
- Registros pendentes de revisão aparecem na fila de revisão (`/revisao`)

**Billing mode:**
- `billing_mode` define a forma de cobrança do pagador (ex: boleto, débito automático). Influencia fluxos de geração de cobrança.

**Contatos extras:**
- `extra_contacts` (JSON) permite armazenar múltiplos contatos (WhatsApp, email secundário) por pagador

---

## Boletos / 2ª Via

**Modelo de dados:**
- `payer_boleto_links` armazena os links de boletos por pagador por mês (`reference_month` no formato `YYYY-MM`)
- **Não existe campo de status de pagamento** nesta tabela — a tabela é de links de acesso, não de cobrança
- O controle de pagamento está em `billings` (tabela separada)

**Pendência de download:**
- Uma pendência de boleto = pagador tem registro em `payer_boleto_links` para o mês, mas **não tem log** em `public_boleto_access_logs` com `action = 'DOWNLOAD'`
- Lógica de cobertura: `payer_boleto_links` do mês ÷ registros de DOWNLOAD do mês = taxa de cobertura

**SEARCH vs DOWNLOAD:**
- `SEARCH` = aluno pesquisou o boleto no portal (pode ter encontrado ou não)
- `DOWNLOAD` = aluno clicou em baixar/visualizar o boleto
- São ações distintas e ambas registradas com timestamp; um SEARCH não implica DOWNLOAD

**Contato WhatsApp:**
- Pagadores com pendência de download podem ser contatados via wa.me deeplink diretamente da tela de logs (`/logs/2via-boletos`)
- A tela suporta envio batch com templates de mensagem (Aviso emissão, Enviar link, Aviso vencimento)

---

## DRE (Demonstração de Resultado)

**Hierarquia:**
```
dre_groups (ex: RECEITAS, CUSTOS, DESPESAS)
  └── dre_subgroups (ex: Mensalidades, Combustível, Salários)
        └── financial_entries (lançamentos individuais)
```

**Tipos de lançamento (`financial_entries.type`):**
- `RECEITA` — entrada de dinheiro (mensalidades, vendas)
- `CUSTO` — custo direto da operação (combustível, pneu)
- `DESPESA` — despesa operacional indireta (aluguel, software)
- `OUTRAS` — lançamentos que não se encaixam nas categorias acima

**Status de lançamento:**
- `PREVISTO` — planejado; não impacta caixa realizado
- `REAL` — efetivado; compõe o DRE de realizado
- Regra de negócio no `useInvoiceImport`: upsert nunca faz downgrade de `REAL` para `PREVISTO`

**Classificação automática:**
- Edge Function `classify-entry` usa IA (Gemini Flash) para sugerir `group_id` e `subgroup_id` com base em descrição, valor e tipo
- Retorna `confidence` (high/medium/low) e `reasoning`
- O operador pode aceitar ou rejeitar a sugestão
- Lançamentos sem classificação ficam com `needs_classification = true`

---

## Excursões

**Ciclo de vida de um assento:**
- `DISPONIVEL` → selecionado pelo comprador → `lock_expires_at` definido (10 minutos)
- Durante o lock: status `VENDIDO`, outros usuários não podem selecionar
- Lock expirado sem pagamento: `release_expired_locks()` (função SQL) restaura para `DISPONIVEL`
- Pagamento confirmado: status permanece `VENDIDO`, `lock_expires_at` limpo

**PIX:**
- `pix_code` armazenado em `public_orders`
- QR code renderizado no frontend via `qrcode.react`

**Funil de leads (`public_excursion_leads.status`):**
```
CAPTURADO → INTERESSE_ASSENTOS → PIX_GERADO → RESERVADO → CONVERTIDO
                                                          → ABANDONADO
```

**Visibilidade pública:**
- `excursions.public_enabled = true` + `public_token` único = excursão acessível em `/public/excursoes/:token`
- `public_enabled = false` = excursão só visível no admin

---

## Afiliados

**Token por excursão:**
- Cada vínculo `affiliate_excursions` gera um `affiliate_token` único
- URLs de venda incluem o token: `/public/excursoes/:token?af=AFFILIATE_TOKEN`
- `AffiliatePortal.tsx` acessível em `/afiliado/:token` com dashboard de comissões do afiliado

**Comissão:**
- Configurada em `affiliates.commission_type` + `commission_value` (padrão do afiliado)
- Pode ser sobreescrita por excursão em `affiliate_excursions.commission_type_override` + `commission_value_override`
- `commission_type` pode ser percentual ou valor fixo
- `affiliate_commissions` é criado no momento do pagamento confirmado do `public_order`

---

## Presença

**Check-in válido:**
- Requer aluno com `students.active = true`
- Requer trip ativa para hoje (`trips.active = true`, `trips.date = today`)
- Geolocalização capturada (latitude, longitude, accuracy) — verificada contra `transport_routes.radius_meters`
- QR code lido deve corresponder a `transport_buses.qr_code_value` de ônibus associado à trip

**Trips automáticas:**
- Função PL/pgSQL `ensure_today_trips()` cria automaticamente as trips do dia para rotas ativas em dias úteis
- Chamada via cron ou trigger no início do dia

**Método de check-in:**
- `method` no registro de attendance: `QR_CODE` (via scanner de câmera), ou outros métodos manuais (admin)

---

## Manutenção

**Prioridade de chamado:**
- `BAIXA` → problema cosmético ou não urgente
- `MEDIA` → impacta operação mas não impede uso
- `ALTA` → impede uso normal do veículo
- `CRITICA` → veículo fora de operação, risco de segurança

**Ciclo de vida do chamado:**
```
ABERTO → EM_ANALISE → EM_EXECUCAO → AGUARDANDO_PECA → CONCLUIDO
                                                      → CANCELADO
```

**Integração financeira:**
- `total_cost_cents = parts_cost_cents + labor_cost_cents`
- Custos de manutenção podem ser vinculados a `financial_entries` (via `vehicle_id`) para compor o DRE

**IA de triagem:**
- Edge Function `maintenance-ai` recebe descrição em texto livre
- Retorna: `vehicle_suggestion`, `title`, `category`, `subcategory`, `priority`, `impact_type`, `description`
- Limite de entrada: 3000 caracteres

---

## Links relacionados

- [[03-fluxo-de-dados]] — Como os dados fluem pelos módulos
- [[07-api-e-endpoints]] — Schema das tabelas de cada módulo
- [[dominio/Glossario]] — Definições de termos do negócio
