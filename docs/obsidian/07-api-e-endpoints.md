# API e Endpoints

## Como o sistema acessa dados

O sistema **não possui API REST própria**. O acesso ao banco é feito diretamente via **Supabase JS Client** (`src/integrations/supabase/client.ts`), que gera queries type-safe a partir dos tipos em `src/integrations/supabase/types.ts`.

```ts
// Exemplo de query
const { data, error } = await supabase
  .from("payers")
  .select("id, name, document_digits, status")
  .eq("status", "ATIVO")
  .order("name")
```

Para lógica server-side (segredos, integrações externas, IA), são usadas as Edge Functions invocadas via:
```ts
const { data, error } = await supabase.functions.invoke("classify-entry", { body: payload })
```

---

## Tabelas por módulo

### Módulo Financeiro

**`payers`** — Pagadores/alunos
- `id` (uuid PK), `name`, `document` (CPF completo), `document_digits` (últimos dígitos, chave pública), `phone`, `email`
- `billing_mode`, `status` (ATIVO|INATIVO), `needs_review` (bool), `review_reason`
- `last_payment_at` (timestamp), `change_log` (JSON), `extra_contacts` (JSON)

**`billings`** — Faturas mensais
- `id`, `payer_id` → payers, `amount_expected_cents`, `amount_paid_cents`
- `reference_month` (YYYY-MM), `due_date`, `status`, `settlement_at`

**`financial_entries`** — Lançamentos contábeis
- `id`, `type` (RECEITA|CUSTO|DESPESA|OUTRAS), `category`, `subcategory`
- `amount_cents`, `date`, `status` (PREVISTO|REAL), `needs_classification` (bool)
- FK: `billing_id` → billings, `card_id` → cards, `payer_id` → payers
- FK: `vehicle_id` → vehicles, `group_id` → dre_groups, `subgroup_id` → dre_subgroups

**`dre_groups`** — Grupos DRE
- `id`, `name` (ex: RECEITAS, CUSTOS, DESPESAS), `order`

**`dre_subgroups`** — Subgrupos DRE
- `id`, `name`, `group_id` → dre_groups, `order`

**`cards`** — Cartões de crédito
- `id`, `name`, `provider`, `card_last4`, `closing_day`, `due_day`

**`installment_contracts`** — Parcelamentos
- `id`, `card_id` → cards, `description`, `total_installments`, `installment_amount_cents`, `start_date`

**`cost_centers`** — Centros de custo
- `id`, `name`, `active`

**`import_logs`** — Logs de importação
- `id`, `type`, `file_name`, `total_rows`, `success_rows`, `error_rows`
- `status`, `diff_summary` (JSON), `errors` (JSON), `created_at`

---

### Módulo Boletos

**`payer_boleto_links`** — Links públicos de boletos
- `id`, `payer_id` → payers, `reference_month` (YYYY-MM), `student_name`, `cpf_digits`, `phone_digits`
- `digitable_line`, `amount_cents`, `due_date`, `drive_url`, `view_url`, `file_id`, `source`
- **Sem campo de pagamento** — apenas link de acesso

**`public_boleto_access_logs`** — Logs de acesso ao portal público
- `id`, `cpf_digits`, `reference_month`, `action` (SEARCH|DOWNLOAD)
- `source`, `drive_url`, `found_count`, `student_name`, `created_at`

---

### Módulo Excursões

**`excursions`** — Excursões
- `id`, `name`, `destination`, `departure_at`, `return_at`
- `vehicle_id` → vehicles, `total_seats`, `seat_price_cents`
- `public_enabled` (bool), `public_token` (uuid único), `status`

**`excursion_seats`** — Assentos de excursão
- `id`, `excursion_id` → excursions, `seat_number`, `status` (DISPONIVEL|VENDIDO), `blocked`

**`public_orders`** — Pedidos do checkout público
- `id`, `excursion_id` → excursions, `passenger_name`, `passenger_document`, `passenger_phone`
- `payment_type`, `status`, `amount_total_cents`, `pix_code`, `seat_ids[]`, `lock_expires_at`

**`ticket_sales`** — Vendas administrativas de ingressos
- `id`, `excursion_id` → excursions, `passenger_id` → passengers

**`passengers`** — Passageiros
- `id`, `name`, `document`, `phone`, `email`

**`public_excursion_leads`** — Leads de venda
- `id`, `excursion_id`, status enum: CAPTURADO|INTERESSE_ASSENTOS|PIX_GERADO|RESERVADO|CONVERTIDO|ABANDONADO

---

### Módulo Transporte

**`vehicles`** — Veículos
- `id`, `name`, `plate`, `model`, `year`, `active`

**`transport_buses`** — Ônibus
- `id`, `name`, `plate`, `vehicle_id` → vehicles, `qr_code_value`

**`transport_routes`** — Rotas
- `id`, `name`, `boarding_location_name`, `boarding_latitude`, `boarding_longitude`, `radius_meters`, `active`

**`trips`** — Viagens
- `id`, `route_id` → transport_routes, `date`, `boarding_start_time`, `trip_type`, `active`

**`bus_assignments`** — Ônibus por viagem
- `id`, `trip_id` → trips, `bus_id` → transport_buses

---

### Módulo Alunos / Presença

**`students`** — Alunos
- `id`, `name`, `registration`, `phone_e164`, `auth_user_id`, `payer_id` → payers
- `default_route_id` → transport_routes, `active`

**`attendance`** — Registros de presença
- `id`, `student_id` → students, `trip_id` → trips, `bus_id` → transport_buses
- `check_in_time`, `status`, `method`, `latitude`, `longitude`, `accuracy`, `evidence` (JSON)

**`attendance_events`** — Eventos de presença
- `id`, `attendance_id` → attendance, `event_type`, `created_at`

**`attendance_settings`** — Configurações do módulo de presença
- `key`, `value` (JSON)

---

### Módulo Afiliados

**`affiliates`** — Parceiros
- `id`, `name`, `responsible`, `email`, `whatsapp`
- `commission_type`, `commission_value`, `status`

**`affiliate_excursions`** — Vínculo afiliado × excursão
- `id`, `affiliate_id` → affiliates, `excursion_id` → excursions
- `affiliate_token` (único), `commission_type_override`, `commission_value_override`

**`affiliate_commissions`** — Comissões geradas
- `id`, `affiliate_id`, `excursion_id`, `order_id` → public_orders
- `amount_sold_cents`, `commission_cents`, `status`

---

### Módulo Manutenção

**`maintenance_tickets`** — Chamados de manutenção
- `id`, `vehicle_id` → vehicles, `title`, `description`
- `priority` (BAIXA|MEDIA|ALTA|CRITICA)
- `status` (ABERTO|EM_ANALISE|EM_EXECUCAO|AGUARDANDO_PECA|CONCLUIDO|CANCELADO)
- `parts_cost_cents`, `labor_cost_cents`, `total_cost_cents`

**`inspection_checklists`** — Checklists de inspeção
- `id`, `vehicle_id`, `driver_id` → drivers, `inspection_date`, `items` (JSON), `status`

**`drivers`** — Motoristas
- `id`, `name`, `cpf`, `rg`, `phone`, `status`

---

### Módulo WhatsApp

**`whatsapp_providers`** — Instâncias Evolution API
- `id`, `name`, `instance_name`, `base_url`, `api_key`, `provider_type` (EVOLUTION), `active`

**`whatsapp_groups`** — Grupos
- `id`, `name`, `group_jid`, `route_id` → transport_routes, `instance_id` → whatsapp_providers, `active`

**`whatsapp_group_students`** — Alunos por grupo
- `id`, `group_id` → whatsapp_groups, `student_id` → students

**`whatsapp_campaigns`** — Campanhas
- `id`, `name`, `status` (DRAFT|QUEUED|PROCESSING|COMPLETED|FAILED)
- `total_messages`, `sent_messages`

**`whatsapp_messages`** — Mensagens individuais
- `id`, `campaign_id` → whatsapp_campaigns, `phone_e164`, `body`
- `status` (PENDING|SENT|DELIVERED|READ|FAILED), `scheduled_at`, `sent_at`

**`whatsapp_contacts`** — Contatos sincronizados
- `id`, `provider_id`, `wa_number`, `wa_jid`, `display_name`

---

### Polls / Enquetes

**`polls`** — Enquetes
- `id`, `question`, `options` (JSON), `selectable_count`, `status`, `group_id` → whatsapp_groups

**`poll_templates`** — Templates
- `id`, `name`, `question`, `options` (JSON), `kind`

**`poll_votes`** — Votos
- `id`, `poll_id` → polls, `student_id` → students, `selected_option`, `vote_status`, `voted_at`

**`poll_dispatch_jobs`** — Jobs de disparo automático
- `id`, `group_id`, `template_id`, `schedule_type`, `cron_expression`, `active`

---

### Tabelas de suporte

**`audit_logs`** — Auditoria de operações
- `id`, `table_name`, `operation`, `actor_user_id`, `actor_email`, `record_id`
- `old_data` (JSON), `new_data` (JSON), `changed_fields[]`, `request_path`

**`processing_jobs`** — Jobs assíncronos
- `id`, `user_id`, `type`, `status`, `progress`, `result` (JSON)

**`landing_settings`** — Configurações da landing page
- `id`, `section`, `enabled`, `content` (JSON)

**`cep`** — CEPs do Brasil
- `cep`, `logradouro`, `bairro`, `cidade`, `uf`

**`profiles`** — Perfis de usuário
- `id` (= auth.users.id), `display_name`, `avatar_url`, `phone`

**`public_tracking_events`** — Eventos de rastreamento público (UTM, cliques)

---

## Edge Functions (supabase/functions/)

### whatsapp-dispatch
- **Input:** `{ action: "process_campaign" | "send_test" | "sync_contacts", campaign_id?, ... }`
- **Output:** `{ success, sent_count, failed_count }`
- **Propósito:** Envia mensagens em lote para campanhas WhatsApp via Evolution API
- **Auth:** API Key no header da Evolution API; timeout 10s com AbortController

### boleto-drive-processor
- **Input:** `{ file_id: string, drive_token: string }`
- **Output:** `{ payer_name, cpf, our_number, digitable_line, amount, due_date }`
- **Propósito:** OCR de PDFs de boletos via Google Drive (Copy → Google Doc → Export texto → Delete)
- **Auth:** Google Drive API v3 Bearer token (OAuth do usuário)

### classify-entry
- **Input:** `{ description, amount_cents, type, existing_groups[], existing_subgroups[] }`
- **Output:** `{ group_id, group_name, subgroup_id, subgroup_name, confidence: "high"|"medium"|"low", reasoning }`
- **Propósito:** Classificação automática de lançamentos financeiros com IA (Gemini Flash, function calling)
- **Auth:** Lovable API Bearer token (segredo no Supabase)

### maintenance-ai
- **Input:** `{ text: string (max 3000 chars), vehicles[] }`
- **Output:** `{ vehicle_suggestion, title, category, subcategory, priority, impact_type, description }`
- **Propósito:** Triagem inteligente de chamados de manutenção a partir de texto livre
- **Auth:** Lovable API Bearer token

### public-boleto-links
- **Input:** Dados do boleto (payer_id, reference_month, digitable_line, etc.)
- **Output:** Link público criado em `payer_boleto_links`
- **Propósito:** Geração de links de acesso ao portal de 2ª via

### student-auth
- **Input:** `{ cpf_digits: string }`
- **Output:** `{ student_id, name, registration, ... }` ou erro
- **Propósito:** Autenticação de alunos por CPF (sem criar usuário Supabase Auth completo)
- **Flow:** valida CPF → SELECT em payers → verifica status ATIVO → retorna student

### address-match
- **Input:** `{ address: string }`
- **Output:** `{ cep, logradouro, bairro, cidade, uf, score }`
- **Propósito:** Matching de endereços livres contra tabela `cep` do banco

### whatsapp-polls
- **Input:** `{ group_id, poll_id }`
- **Output:** `{ success, dispatched_count }`
- **Propósito:** Despacha enquetes para grupos WhatsApp via Evolution API

---

## Views

**`excursion_orders`** — VIEW sobre `public_orders` com JOIN em `excursions`:
- Exibe pedidos com dados da excursão (nome, destino, datas) agregados

---

## Funções PL/pgSQL

| Função | Propósito |
|--------|-----------|
| `ensure_today_trips()` | Cria trips automáticas para hoje (apenas dias úteis), para todas as rotas ativas |
| `get_billings_summary(p_month)` | Retorna resumo de faturas do mês: total esperado, total pago, inadimplentes |
| `get_dre_summary(p_month)` | Retorna DRE consolidado do mês por grupo/subgrupo |
| `release_expired_locks()` | Libera assentos de excursão com `lock_expires_at` expirado e status RESERVADO |
| `reserve_seats()` | Reserva assentos, cria `public_order`, gera PIX, define `lock_expires_at` |

---

## Links relacionados

- [[01-arquitetura]] — Visão geral de como o sistema usa o Supabase
- [[09-integracoes]] — Detalhes das APIs externas usadas pelas Edge Functions
- [[03-fluxo-de-dados]] — Como os dados fluem entre tabelas nos casos de uso principais
