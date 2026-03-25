# Débitos Técnicos

## Arquivos grandes (refatoração prioritária)

Arquivos acima de ~500 linhas geralmente indicam múltiplas responsabilidades misturadas (God Component/God Hook). São os candidatos prioritários para refatoração.

| Arquivo | Linhas | Problema | Prioridade |
|---------|--------|----------|------------|
| `src/pages/Import.tsx` | 2050 | Preview + lógica de parse + validação + UI de confirmação tudo junto; deveria ser separado em componentes de etapas e hook dedicado | ALTA |
| `src/pages/FinancialExpenses.tsx` | 1911 | Gestão de despesas, cartões e parcelamentos numa única tela; lógica de filtros e formulários misturada | ALTA |
| `src/pages/AddressMatch.tsx` | 1623 | Engine de matching + UI + resultados no mesmo arquivo; lógica de engine já existe em `src/lib/address-match-engine.ts` mas a página repete parte dela | MÉDIA |
| `src/pages/BoletoAccessLogs.tsx` | 1172 | Logs + cobertura mensal + pendências + contato WhatsApp + batch actions; múltiplos sub-módulos num só arquivo | MÉDIA |
| `src/hooks/useOptimizedImport.ts` | 1028 | Hook com múltiplos tipos de importação (payers, boletos, CEPs) em funções distintas; poderia ser decomposto em hooks especializados | MÉDIA |
| `src/hooks/useImport.ts` | 811 | Versão anterior do hook de importação (ver seção Possíveis Duplicações); possível dead code | MÉDIA |
| `src/components/boletos/DriveProcessorTab.tsx` | 710 | Fluxo OAuth + upload + chamada de Edge Function + exibição de resultados + confirmação em 710 linhas | MÉDIA |
| `src/components/payers/PayerDetailsModal.tsx` | 567 | Modal com dados cadastrais + histórico de faturas + change_log + extra_contacts + ações; poderia ser decomposto em tabs com sub-componentes | BAIXA |

**Critério de refatoração:** dividir por responsabilidade (UI de listagem ≠ lógica de negócio ≠ formulário ≠ hook de dados). O padrão existente no projeto já aponta nessa direção (hooks separados, lib separada) — basta aplicar consistentemente.

---

## Possíveis duplicações

### useImport.ts vs useOptimizedImport.ts

| Aspecto | `useImport.ts` (811 lin) | `useOptimizedImport.ts` (1028 lin) |
|---------|--------------------------|-------------------------------------|
| Batch processing | Não documentado | Batches de 100 items explicitamente |
| Referência em Import.tsx | Não confirmada | Confirmada |
| Status | Possivelmente dead code | Em uso ativo |
| Ação recomendada | Auditar chamadas; se sem uso, remover | Manter e refatorar se necessário |

**Risco de remover useImport.ts sem auditoria:** pode quebrar algum fluxo não óbvio (importação de faturas? outro módulo?). Verificar antes com busca por `useImport` no codebase.

### useDashboardStats vs useEnhancedDashboard

| Aspecto | `useDashboardStats` | `useEnhancedDashboard` |
|---------|--------------------|-----------------------|
| Cache key | `["dashboard-stats", currentMonth]` | `["enhanced-dashboard", dateRange]` |
| Fonte de dados | payers + billings | financial_entries |
| Granularidade | Resumo mensal fixo | Range de datas configurável |
| Sobreposição | KPIs de pagamentos | KPIs financeiros detalhados |

São hooks diferentes mas servem a mesma tela (Dashboard). Possível unificar ou definir claramente a divisão de responsabilidades para evitar queries redundantes.

---

## Qualidade de código

### console.log/warn/error espalhados

Aproximadamente **27 instâncias** de `console.log`, `console.warn` e `console.error` identificadas no código de produção. Logs de debug devem ser removidos antes de deploy em produção.

- **Risco:** vazar dados sensíveis (valores, CPFs parciais, tokens) no console do navegador
- **Mitigação existente:** `DiagnosticsContext` já intercepta erros reais — o canal correto para logs de diagnóstico
- **Ação:** audit completo com `grep -r "console\." src/` e remoção seletiva (manter apenas logs intencionais via DiagnosticsContext)

### Queries com `select("*")`

Algumas queries usam `select("*")` em vez de listar campos explícitos. Problemas:

- **Performance:** retorna colunas desnecessárias (ex: `change_log` JSON grande quando só precisa de `name` e `status`)
- **Type safety:** perde parte dos benefícios do `supabase gen types` (tipo retornado é `any` ou genérico demais)
- **Manutenção:** mudanças de schema podem passar despercebidas
- **Ação:** substituir por `select("id, name, status, ...")` com campos explícitos nas queries mais frequentes

---

## Ausência de testes automatizados

Nenhum arquivo de teste detectado no projeto. Sem Cypress, Playwright, Vitest com testes de componente ou testes de integração.

| Área | Risco sem testes | Sugestão inicial |
|------|-----------------|-----------------|
| `src/lib/csv-import.ts` | Regressões em parsing de CPF/CEP/notação científica | Unit tests com Vitest |
| `src/lib/address-match-engine.ts` | Regressões no algoritmo Levenshtein | Unit tests com Vitest |
| Fluxo de importação CSV | Dados silenciosamente corrompidos | Integration test com dados reais anonimizados |
| Checkout de excursão (lock + PIX) | Falhas de reserva em produção | E2E com Playwright (ou Cypress) |
| Portal 2ª via | Aluno não consegue encontrar boleto | E2E básico |

**Prioridade de introdução de testes:** começar por utilitários puros (`src/lib/`) pois não dependem de Supabase ou browser — custo baixo, retorno imediato.

---

## Impacto do staleTime default (0)

**Comportamento atual:** TanStack Query com `staleTime: 0` (default) marca todos os dados como stale imediatamente após o fetch. Isso significa:

- Toda vez que o usuário troca de aba e volta → refetch de todas as queries ativas
- Toda vez que uma query é montada/remontada → refetch
- Em páginas com múltiplos hooks (ex: Dashboard com 2+ hooks) → múltiplas requests paralelas ao banco

**Impacto observado:**
- Potencial aumento de conexões no PostgreSQL em uso intenso
- Flickering visual em dados que raramente mudam (ex: lista de veículos, rotas)

**Ação sugerida:**
- Dados estáticos (veículos, rotas, grupos DRE): `staleTime: 5 * 60 * 1000` (5 minutos)
- Dados operacionais (pagadores, boletos do mês): `staleTime: 60 * 1000` (1 minuto)
- Dados em tempo real (presença, trips): manter `staleTime: 0` + `refetchInterval` explícito

---

## Links relacionados

- [[11-proximos-passos]] — Roadmap de refatorações e features
