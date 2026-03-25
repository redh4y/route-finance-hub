# Integrações Externas

## Supabase Auth

**Propósito:** Autenticação de usuários administrativos. Gerencia sessões JWT, refresh de tokens e logout.

**Onde é usado:**
- `src/contexts/AuthContext.tsx` — provedor central da sessão
- `src/integrations/supabase/client.ts` — instância única do Supabase JS client
- Todas as queries e mutations usam a sessão para autorização via RLS no banco

**Como autentica:**
- `supabase.auth.signInWithPassword({ email, password })` para login
- `supabase.auth.onAuthStateChange()` para reatualização reativa da sessão
- JWT armazenado em `localStorage`, renovado automaticamente (`autoRefreshToken: true`)

**Notas de implementação:**
- `ProtectedRoute` verifica `user !== null` antes de renderizar páginas admin
- O campo `profiles.id` espelha `auth.users.id` para dados adicionais do usuário (display_name, avatar_url, phone)
- RLS (Row Level Security) é a camada de autorização de banco — políticas definidas por tabela no Supabase

---

## Google Drive API v3

**Propósito:** OCR de PDFs de boletos bancários. O fluxo extrai texto estruturado de boletos enviados ao Google Drive pelo escritório, sem necessidade de servidor de OCR próprio.

**Onde é usado:**
- Edge Function `boleto-drive-processor` — executa o OCR server-side
- `src/hooks/useDriveProcessor.ts` — gerencia o fluxo OAuth client-side e armazena token
- `src/components/boletos/DriveProcessorTab.tsx` — UI do fluxo de processamento (710 linhas)

**Como autentica:**
- OAuth 2.0 com Google (fluxo Authorization Code)
- O usuário autoriza acesso ao Drive via popup do Google
- Token OAuth armazenado em `localStorage` pelo `useDriveProcessor`
- Token é enviado como Bearer no header para a Edge Function `boleto-drive-processor`
- A Edge Function usa o token para chamar a Google Drive API v3 em nome do usuário

**Fluxo de OCR:**
1. Copia o PDF no Drive (`files.copy`)
2. Google converte a cópia para Google Doc automaticamente (dispara OCR)
3. Exporta o Google Doc como texto puro (`files.export?mimeType=text/plain`)
4. Deleta o Google Doc temporário (`files.delete`)
5. Faz parse do texto extraído para obter: `payer_name`, `cpf`, `our_number`, `digitable_line`, `amount`, `due_date`

**Notas de implementação:**
- Requer que os PDFs de boletos estejam em pasta compartilhada com a conta que fará o OAuth
- O scope OAuth necessário é `https://www.googleapis.com/auth/drive`
- Erros de OCR (PDF corrompido, layout diferente) resultam em campos null no output

---

## Evolution API (WhatsApp)

**Propósito:** Envio de mensagens WhatsApp em massa e despacho de enquetes para grupos. Substitui a API oficial do WhatsApp Business (mais flexível para o volume e caso de uso da empresa).

**Onde é usado:**
- Edge Function `whatsapp-dispatch` — campanhas de mensagens individuais
- Edge Function `whatsapp-polls` — envio de enquetes para grupos
- `src/pages/Whatsapp.tsx` — UI de gestão de campanhas e grupos

**Como autentica:**
- API Key enviada no header `apikey: <valor>` de cada request à Evolution API
- `api_key` e `base_url` são armazenados em `whatsapp_providers` no banco
- A Edge Function lê esses valores do banco antes de chamar a Evolution API

**Endpoints usados:**
- `POST /message/sendText/{instance}` — envia mensagem de texto para número individual
- `POST /message/sendPoll/{instance}` — envia enquete para grupo
- `GET /contact/fetchContacts/{instance}` — sincroniza contatos
- Timeout configurado em 10s com `AbortController`

**Notas de implementação:**
- Uma instância Evolution API (`whatsapp_providers.instance_name`) corresponde a um número WhatsApp conectado via QR code
- Múltiplos providers podem ser configurados (ex: um por número de telefone da empresa)
- `whatsapp_groups.group_jid` é o identificador do grupo no WhatsApp (formato: `<número>@g.us`)
- Campanhas processadas com `status` QUEUED → PROCESSING → COMPLETED|FAILED, com `sent_messages` atualizado incrementalmente

---

## Lovable AI / Gemini Flash

**Propósito:** Processamento de linguagem natural para duas tarefas: (1) classificação automática de lançamentos financeiros no DRE e (2) triagem inteligente de chamados de manutenção de frota.

**Onde é usado:**
- Edge Function `classify-entry` — classifica `financial_entries`
- Edge Function `maintenance-ai` — triagem de chamados de manutenção
- `src/hooks/useClassifyEntry.ts` — invoca a Edge Function `classify-entry` do frontend

**Como autentica:**
- Bearer token para a Lovable API (armazenado como secret no Supabase)
- A Edge Function injeta o token no header `Authorization: Bearer <token>`
- O modelo usado é Gemini Flash 2.0 (via Lovable API)

**Implementação — classify-entry:**
- Usa function calling: o modelo recebe a lista de grupos e subgrupos existentes e retorna IDs
- Output inclui `confidence` (high/medium/low) e `reasoning` (texto explicativo)
- O operador vê a sugestão no frontend e pode aceitar ou rejeitar

**Implementação — maintenance-ai:**
- Input: texto livre descrevendo o problema (máx 3000 chars) + lista de veículos cadastrados
- Output estruturado: `vehicle_suggestion`, `title`, `category`, `subcategory`, `priority`, `impact_type`, `description`
- Permite ao operador abrir um chamado a partir de uma descrição informal

**Notas de implementação:**
- Sem persistência de histórico de conversas — cada chamada é independente
- Erros de API (rate limit, timeout) são tratados com fallback para classificação manual
- Custo de API proporcional ao volume de lançamentos importados e chamados criados

---

## wa.me (WhatsApp deeplinks)

**Propósito:** Abrir conversa WhatsApp diretamente no app do usuário para contato com pagadores inadimplentes ou com pendências de download de boleto.

**Onde é usado:**
- `src/pages/BoletoAccessLogs.tsx` — botões de contato individual e batch na lista de pendências
- `src/pages/PublicBoletoLinksPage.tsx` — suporte ao cliente no portal público

**Como funciona:**
- Link no formato `https://wa.me/<phone_e164>?text=<mensagem_codificada>`
- Número formatado em E.164 (ex: `5511987654321`)
- Mensagem pré-preenchida com template (ex: "Seu boleto de [mês] está disponível: [link]")
- Aberto via `window.open(url, "_blank")`

**Notas de implementação:**
- Não requer autenticação — é um deeplink público
- O texto da mensagem é URL-encoded antes de compor o link
- Emojis no texto são codificados como UTF-8 no URL
- Botões de envio batch iteram sobre a lista de pendências e abrem uma aba por destinatário (ou aguardam confirmação do usuário para múltiplas abas)

---

## Google OAuth (acesso ao Drive)

**Propósito:** Autorizar o usuário admin a acessar sua conta Google Drive para o fluxo de processamento OCR de boletos.

**Onde é usado:**
- `src/hooks/useDriveProcessor.ts` — gerencia o fluxo OAuth e armazena o token
- `src/pages/OAuthCallback.tsx` — recebe o callback OAuth de `/oauth/callback`

**Como autentica:**
- Fluxo Authorization Code com redirect para `/oauth/callback`
- `OAuthCallback.tsx` extrai o código da URL, troca pelo access token via endpoint Google OAuth
- Token armazenado em `localStorage` (não em cookie seguro — débito técnico de segurança menor)
- Token é passado para a Edge Function `boleto-drive-processor` para cada operação de OCR

---

## Links relacionados

- [[01-arquitetura]] — Onde cada integração se encaixa na arquitetura
- [[07-api-e-endpoints]] — Edge Functions que usam as integrações
