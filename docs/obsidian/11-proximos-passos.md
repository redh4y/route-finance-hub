# Próximos Passos e Roadmap

## Curto prazo (features de produto)

### 1. Fila de revisão operacional centralizada
- **O que é:** tela unificada de revisão para pagadores com `needs_review = true`, boletos sem match de pagador, e importações com erros
- **Por que agora:** a importação de dados gera pendências que hoje ficam espalhadas em telas diferentes; uma fila central reduz erro operacional
- **Arquivo de entrada:** `src/pages/ReviewInbox.tsx` (já existe, expandir funcionalidades)

### 2. Regras automáticas de qualidade (soft validation)
- **O que é:** validações que não bloqueiam a importação mas geram alertas (ex: CPF com dígito verificador inválido, phone em formato inesperado, email sem @)
- **Por que agora:** hoje importações silenciosamente aceitam dados malformados; soft validation melhora qualidade sem bloquear fluxo
- **Arquivo de entrada:** `src/lib/csv-import.ts` + `useOptimizedImport.ts`

### 3. Motor de classificação DRE (sugestões automáticas)
- **O que é:** ao importar lançamentos financeiros, sugerir automaticamente grupo e subgrupo DRE usando a Edge Function `classify-entry`
- **Por que agora:** a Edge Function já existe e funciona; integração com o fluxo de importação aumenta o aproveitamento
- **Arquivo de entrada:** `useInvoiceImport.ts` + `src/pages/FinancialExpenses.tsx`

---

## Médio prazo

### 4. Versionamento de importação (run_id + rollback)
- **O que é:** cada execução de importação recebe um `run_id`; o operador pode reverter todos os registros de uma importação específica
- **Motivação:** hoje uma importação errada não tem rollback — requer correção manual registro a registro
- **Dependências:** `import_logs` já existe; adicionar `run_id` em `payers` e `payer_boleto_links`; criar procedure de rollback

### 5. Conciliação financeira completa
- **O que é:** cruzamento automático de extratos bancários (CSV importado) com `financial_entries` existentes, marcando as entradas conciliadas
- **Página existente:** `Reconciliation.tsx` — funcionalidade a completar
- **Dependências:** definir formato de importação de extrato; criar status de conciliação em `financial_entries`

### 6. Governança e auditoria aprimorada
- **O que é:** expandir `audit_logs` para capturar mais operações (não só CRUD); criar relatório de auditoria navegável por usuário, por tabela e por período
- **Página existente:** `Audit.tsx` — expandir visualização
- **Motivação:** conformidade e rastreabilidade de alterações em dados financeiros

### 7. KPIs operacionais (custo por veículo/rota/aluno)
- **O que é:** dashboard de indicadores que cruzam `financial_entries` (custos por `vehicle_id`) com dados de rotas, alunos e trips
- **Motivação:** hoje a empresa não tem visibilidade de rentabilidade por rota ou custo por aluno atendido
- **Dependências:** melhoria na categorização de lançamentos por veículo (campo `vehicle_id` em `financial_entries` já existe)

---

## Longo prazo

### 8. Comercial de excursões (funil público completo)
- **O que é:** funil completo de vendas públicas com gestão de leads, remarketing via WhatsApp, relatório de conversão por excursão
- **Status atual:** funil básico existe (`public_excursion_leads` com status enum), mas sem automação de follow-up
- **Dependências:** integração entre `public_excursion_leads` e campanhas WhatsApp

### 9. Cancelamento e reembolso (fluxo padrão)
- **O que é:** fluxo estruturado para cancelamento de reserva de excursão com reembolso parcial ou total, liberação de assento e atualização de comissão de afiliado
- **Status atual:** não existe; cancelamentos são feitos manualmente pelo admin
- **Dependências:** definir política de reembolso; criar status CANCELADO em `public_orders`; estornar `affiliate_commissions`

### 10. Performance e escala (paginação server-side, índices compostos)
- **O que é:** substituir queries que retornam todos os registros por paginação server-side (cursor-based ou offset); adicionar índices compostos para as queries mais lentas
- **Motivação:** `Payers.tsx` e `BoletoAccessLogs.tsx` carregam todos os registros do mês em memória; com crescimento do volume isso se torna lento
- **Quick wins:** índices em `(reference_month, payer_id)` em `payer_boleto_links`; índice em `(cpf_digits, reference_month)` em `public_boleto_access_logs`

### 11. Sincronização WhatsApp Evolution + Supabase (contatos)
- **O que é:** sincronização periódica dos contatos WhatsApp (via `sync_contacts` da `whatsapp-dispatch`) com `students` e `payers`, mantendo `whatsapp_contacts` atualizada
- **Status atual:** sync manual disponível; não é automático
- **Dependências:** definir estratégia de merge (phone_e164 como chave); cron job no Supabase

---

## Refatorações técnicas prioritárias

Ordenadas por impacto/esforço:

| Prioridade | Arquivo | Ação | Esforço | Impacto |
|------------|---------|------|---------|---------|
| 1 | `Import.tsx` (2050 lin) | Separar em: `ImportUploadStep`, `ImportPreviewStep`, `ImportConfirmStep` + mover lógica para hooks | Alto | Alto (legibilidade + testabilidade) |
| 2 | `FinancialExpenses.tsx` (1911 lin) | Separar listagem de despesas, formulário de lançamento, gestão de parcelamentos em componentes distintos | Alto | Alto |
| 3 | `useImport.ts` (811 lin) | Auditar uso real; se dead code, remover | Baixo | Médio (reduz confusão) |
| 4 | Adicionar `staleTime` nos hooks | Configurar staleTime por categoria de dado (estático vs operacional vs tempo-real) | Baixo | Médio (performance) |
| 5 | Remover `console.log` de produção | Grep + revisão manual das ~27 instâncias | Baixo | Médio (segurança/limpeza) |
| 6 | Introduzir testes em `src/lib/` | Vitest para `csv-import.ts` e `address-match-engine.ts` | Médio | Alto (confiança em refatorações) |
| 7 | `AddressMatch.tsx` (1623 lin) | Mover lógica de match para hook; página só exibe UI | Médio | Médio |
| 8 | Substituir `select("*")` nas queries principais | Listar campos explicitamente nas queries mais frequentes | Baixo | Baixo-Médio |

---

## Como priorizar

**Critérios:**
1. **Bloqueia operação?** — prioridade máxima, independente de esforço
2. **Risco de dados silenciosamente errados?** — alta prioridade (ex: regras de qualidade na importação)
3. **Reduz esforço de todas as próximas features?** — alta prioridade (ex: testes, separação de responsabilidades em Import.tsx)
4. **Melhora performance visível?** — prioridade média
5. **Cleanup/dívida técnica pura?** — prioridade baixa, fazer em paralelo com outras tarefas

**Sequência recomendada para início:**
1. Auditar `useImport.ts` (1 hora, baixo risco)
2. Adicionar `staleTime` nos hooks (2 horas, zero risco)
3. Remover `console.log` de produção (1 hora, zero risco)
4. Criar primeiros testes em `src/lib/csv-import.ts` (4 horas, base para refatorações futuras)
5. Refatorar `Import.tsx` em etapas (1-2 dias, maior impacto na manutenibilidade)

---

## Links relacionados

- [[10-debitos-tecnicos]] — Detalhes técnicos dos débitos listados neste roadmap
- [[04-regras-de-negocio]] — Regras de negócio das features do roadmap
