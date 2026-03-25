# Estrutura de Pastas

## Árvore completa com descrições

```
route-finance-hub/
│
├── src/
│   ├── pages/                  # 48 páginas (uma por rota do React Router)
│   │   ├── Dashboard.tsx       # /dashboard — KPIs e gráficos executivos
│   │   ├── Payers.tsx          # /pagadores — CRUD de pagadores (967 linhas)
│   │   ├── Import.tsx          # /importar — Importação CSV/Excel (2050 linhas)
│   │   ├── BoletoAccessLogs.tsx# /logs/2via-boletos — Logs e pendências (1172 linhas)
│   │   ├── Financial.tsx       # /financeiro — DRE
│   │   ├── FinancialExpenses.tsx# /financeiro/saidas (1911 linhas)
│   │   ├── AddressMatch.tsx    # /match-enderecos (1623 linhas)
│   │   └── ...                 # demais páginas (ver [[05-telas-e-fluxos]])
│   │
│   ├── components/             # 85+ componentes organizados por feature
│   │   ├── ui/                 # Design system (shadcn/ui — Button, Dialog, Table, etc.)
│   │   ├── layout/             # MainLayout.tsx (306 linhas), Sidebar.tsx
│   │   ├── dashboard/          # Componentes de KPIs e gráficos do dashboard
│   │   ├── boletos/            # Componentes do módulo de boletos e 2ª via
│   │   │   └── DriveProcessorTab.tsx  # 710 linhas — integração Google Drive OCR
│   │   ├── payers/             # Modais e cards de pagadores
│   │   │   └── PayerDetailsModal.tsx  # 567 linhas — detalhe de pagador
│   │   ├── excursions/         # Formulários, cards, seat map de excursões
│   │   ├── financial/          # Componentes de DRE, receitas, despesas
│   │   ├── attendance/         # Check-in QR, dashboard de aluno, histórico
│   │   ├── landing/            # Seções da landing page pública
│   │   ├── checkout/           # Fluxo de compra de assentos (público)
│   │   └── admin/              # Componentes do painel admin
│   │
│   ├── hooks/                  # 23 custom hooks (todos prefixados com "use")
│   │   ├── usePayers.ts        # CRUD completo de pagadores
│   │   ├── useOptimizedImport.ts  # 1028 linhas — importação em batches
│   │   ├── useImport.ts        # 811 linhas — importação anterior (auditar uso)
│   │   ├── useExcursions.ts    # Excursões + assentos + vendas
│   │   ├── useAttendance.ts    # Presença com refetchInterval 15-30s
│   │   └── ...                 # demais hooks (ver [[08-estados-e-hooks]])
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Autenticação Supabase Auth (user, session, signIn, signOut)
│   │   └── DiagnosticsContext.tsx  # Interceptação de erros e logs para diagnóstico
│   │
│   ├── lib/                    # Engines e utilitários puros (sem React)
│   │   ├── address-match-engine.ts  # 787 linhas — Levenshtein + normalização de endereços
│   │   ├── csv-import.ts       # Parse CSV, normalização CPF/CEP/phone, notação científica Excel
│   │   ├── export-utils.ts     # Export para Excel, CSV, PDF (print)
│   │   ├── formatters.ts       # Moeda, datas, CPF, telefone (pt-BR)
│   │   ├── invoice-import.ts   # Importação de notas fiscais/faturas
│   │   └── utils.ts            # cn() helper (classNames merge com tailwind-merge)
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Instância do Supabase JS client (singleton)
│   │       └── types.ts        # Tipos TypeScript gerados pelo "supabase gen types"
│   │
│   └── assets/                 # Imagens, SVGs estáticos
│
├── supabase/
│   ├── functions/              # 8 Edge Functions em Deno (TypeScript)
│   │   ├── whatsapp-dispatch/
│   │   ├── boleto-drive-processor/
│   │   ├── classify-entry/
│   │   ├── maintenance-ai/
│   │   ├── public-boleto-links/
│   │   ├── student-auth/
│   │   ├── address-match/
│   │   └── whatsapp-polls/
│   └── migrations/             # Arquivos SQL de migração do banco
│
├── scripts/                    # Scripts de manutenção do repositório
│   ├── encoding-guard          # Verifica encoding de arquivos
│   ├── fix-encoding            # Corrige encoding
│   └── check-encoding          # Checar encoding antes de commit
│
├── public/                     # Assets públicos (favicon, manifest PWA, etc.)
│
└── docs/obsidian/              # Este vault Obsidian
    ├── Home.md
    ├── dominio/
    │   └── Glossario.md
    ├── features/
    │   └── Portal-2a-Via-Boletos.md
    ├── decisoes/
    │   └── ADR-001-url-boleto.md
    └── templates/
```

---

## Convenções de nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Páginas | PascalCase + sufixo implícito | `Payers.tsx`, `ExcursionDetail.tsx` |
| Componentes | PascalCase | `PayerDetailsModal.tsx`, `DriveProcessorTab.tsx` |
| Hooks | camelCase prefixado `use` | `usePayers.ts`, `useOptimizedImport.ts` |
| Utilitários | kebab-case | `address-match-engine.ts`, `csv-import.ts` |
| Edge Functions | kebab-case (pasta) | `whatsapp-dispatch/`, `classify-entry/` |
| Contextos | PascalCase + sufixo `Context` | `AuthContext.tsx`, `DiagnosticsContext.tsx` |
| Tipos Supabase | gerado automaticamente em `types.ts` | `Database["public"]["Tables"]["payers"]["Row"]` |

---

## Onde criar novos arquivos

| O que criar | Onde colocar |
|-------------|-------------|
| Nova página (nova rota) | `src/pages/NomePagina.tsx` + registrar em `src/App.tsx` |
| Componente reutilizável de feature | `src/components/<feature>/NomeComponente.tsx` |
| Componente genérico de UI | `src/components/ui/` (apenas se for extensão do shadcn/ui) |
| Hook de dados (Supabase query/mutation) | `src/hooks/useNomeFeature.ts` |
| Utilitário puro (sem React) | `src/lib/nome-util.ts` |
| Edge Function nova | `supabase/functions/nome-funcao/index.ts` |
| Migração de banco | `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql` |
| Spec de feature | `docs/obsidian/features/Nome-Da-Feature.md` |
| Decisão técnica (ADR) | `docs/obsidian/decisoes/ADR-NNN-titulo.md` |

---

## Links relacionados

- [[06-componentes]] — Detalhamento de componentes por categoria
- [[08-estados-e-hooks]] — Lista completa de hooks e suas responsabilidades
