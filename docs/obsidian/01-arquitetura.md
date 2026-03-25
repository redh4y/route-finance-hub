# Arquitetura do Sistema

## Diagrama geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / PWA                            │
│                                                                 │
│  React 18 SPA (48 páginas, React Router v6)                     │
│  TanStack Query  ←→  Supabase JS Client                         │
│                                ↓                                │
└────────────────────────────────│────────────────────────────────┘
                                 │ HTTPS / WebSocket
┌────────────────────────────────▼────────────────────────────────┐
│                        SUPABASE (BaaS)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL  │  │  Auth (JWT)  │  │  Edge Functions (Deno)│ │
│  │  45 tabelas  │  │  Sessions    │  │  8 funções            │ │
│  │  Views + RPC │  │  RLS         │  └──────────┬────────────┘ │
│  └──────────────┘  └──────────────┘             │              │
└─────────────────────────────────────────────────│──────────────┘
                                                  │ HTTPS
          ┌───────────────────────────────────────┼──────────────┐
          │                                       │              │
          ▼                                       ▼              ▼
  ┌──────────────┐                    ┌──────────────┐  ┌──────────────┐
  │ Google Drive │                    │ Evolution API│  │ Lovable AI   │
  │ API v3       │                    │ (WhatsApp)   │  │ (Gemini Flash│
  │ OAuth + OCR  │                    │ API Key auth │  │ function call│
  └──────────────┘                    └──────────────┘  └──────────────┘
```

---

## Frontend

- **Tipo:** SPA (Single Page Application), instalável como PWA via `vite-plugin-pwa`
- **Total de páginas:** 48 (ver [[05-telas-e-fluxos]])
- **Roteamento:** React Router v6 (`BrowserRouter`), definido em `src/App.tsx`
- **Proteção de rotas:** componente `<ProtectedRoute>` verifica `user` do `AuthContext`; rotas públicas sem wrapper
- **Layout padrão de página:** `<MainLayout><PageTransition>{conteúdo}</PageTransition></MainLayout>`
- **Data fetching:** TanStack React Query v5 — hooks customizados chamam Supabase JS; mutations invalidam cache no `onSuccess`
- **Offline:** service worker via PWA para assets estáticos; dados dependem de conectividade Supabase

---

## Backend (Supabase como BaaS)

O sistema não possui servidor próprio. Todo o backend é operado pelo Supabase:

| Componente | Papel |
|------------|-------|
| **PostgreSQL** | Banco principal, 45 tabelas, views, funções PL/pgSQL, RLS |
| **Supabase Auth** | Autenticação JWT, sessão persistida em localStorage, `autoRefreshToken` ativado |
| **Row Level Security (RLS)** | Controle de acesso por linha no banco; políticas definidas por tabela |
| **Realtime** | Subscriptions WebSocket (usado em hooks de presença com `refetchInterval`) |
| **Storage** | Não usado diretamente — PDFs de boletos ficam no Google Drive |
| **Edge Functions** | Lógica server-side que requer segredos ou integração com APIs externas |

**Por que Supabase sem backend próprio:** reduz custo operacional, elimina necessidade de infraestrutura própria, fornece Auth + banco + edge functions em um único serviço gerenciado com SDK type-safe gerado pelo `supabase gen types`.

---

## Edge Functions (supabase/functions/)

Oito funções Deno deployadas no Supabase:

| Função | Propósito |
|--------|-----------|
| `whatsapp-dispatch` | Processa campanhas WhatsApp via Evolution API (envio em lote, teste, sync de contatos) |
| `boleto-drive-processor` | Extrai dados de boletos via Google Drive OCR (copia PDF → Google Doc → exporta texto) |
| `classify-entry` | Classifica lançamentos financeiros com IA (Lovable/Gemini Flash, function calling) |
| `maintenance-ai` | Sugere título, categoria, prioridade de chamado de manutenção via IA |
| `public-boleto-links` | Gera links públicos de boletos para o portal 2ª via |
| `student-auth` | Autentica alunos por CPF (valida → match em `payers.document_digits` → retorna student) |
| `address-match` | Matching de endereços consultando tabela `cep` |
| `whatsapp-polls` | Despacha enquetes para grupos WhatsApp via Evolution API |

---

## Decisões arquiteturais

**Por que Supabase:**
- Fornece PostgreSQL + Auth + Edge Functions + RLS + SDK type-safe em um produto
- Elimina necessidade de API REST própria para operações CRUD
- `supabase gen types` mantém tipos TypeScript sincronizados com o schema real do banco

**Por que sem backend próprio:**
- Operação de baixo custo; equipe pequena
- Edge Functions cobrem os casos que precisam de lógica server-side (segredos de API, OCR, IA)
- Supabase RLS substitui middleware de autorização

**Por que IA via Lovable API (Gemini Flash):**
- Classificação DRE e triagem de manutenção são tarefas de linguagem natural que se beneficiam de LLM
- Lovable API abstrai o provedor (Gemini Flash 2.0) com function calling
- Custo operacional aceitável para volume atual

---

## Links relacionados

- [[07-api-e-endpoints]] — Tabelas, views, funções PL/pgSQL e Edge Functions detalhadas
- [[09-integracoes]] — Google Drive, Evolution API, Lovable AI
- [[08-estados-e-hooks]] — Como o frontend gerencia estado e cache
