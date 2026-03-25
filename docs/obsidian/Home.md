# Tavares Finance · Segundo Cérebro

Sistema de gestão integrado para a **Tavares Transportes** — transporte escolar e excursões.
Repositório: `route-finance-hub` | Stack: React 18 + TypeScript + Supabase + PostgreSQL

---

## Navegação principal

| # | Documento | O que cobre |
|---|-----------|-------------|
| 00 | [[00-visao-geral]] | O que é o sistema, módulos, stack, público-alvo |
| 01 | [[01-arquitetura]] | Diagrama do sistema, Frontend, Supabase BaaS, Edge Functions, decisões arquiteturais |
| 02 | [[02-estrutura-de-pastas]] | Árvore de pastas comentada, convenções, onde criar novos arquivos |
| 03 | [[03-fluxo-de-dados]] | 6 fluxos detalhados: auth, data fetching, 2ª via boletos, importação, excursão pública, presença |
| 04 | [[04-regras-de-negocio]] | Regras por módulo: pagadores, boletos, DRE, excursões, afiliados, presença, manutenção |
| 05 | [[05-telas-e-fluxos]] | Tabela das 48 páginas com rota, arquivo, tipo e módulo; portais públicos |
| 06 | [[06-componentes]] | Componentes por categoria, componentes críticos detalhados, design system |
| 07 | [[07-api-e-endpoints]] | Tabelas do banco (45), Edge Functions (8), views, funções PL/pgSQL, enums |
| 08 | [[08-estados-e-hooks]] | AuthContext, DiagnosticsContext, tabela dos 23 hooks, padrões React Query |
| 09 | [[09-integracoes]] | Supabase Auth, Google Drive OCR, Evolution API WhatsApp, Lovable AI, wa.me |
| 10 | [[10-debitos-tecnicos]] | Arquivos grandes, duplicações, console.logs, ausência de testes, staleTime |
| 11 | [[11-proximos-passos]] | Roadmap curto/médio/longo prazo + refatorações prioritárias |
| 99 | [[99-log-de-alteracoes]] | Histórico de todas as mudanças de feature e regra de negócio |

---

## Referências de domínio e decisões

| Documento | O que cobre |
|-----------|-------------|
| [[dominio/Glossario]] | Termos do negócio e do sistema (fonte de verdade de nomenclatura) |
| [[decisoes/ADR-001-url-boleto]] | Decisão sobre estrutura de URLs do portal de boletos |
| [[features/Portal-2a-Via-Boletos]] | Spec completa do portal de 2ª via de boletos |
| [[features/Importacao-de-Dados]] | Índice da importação em massa — links para as 4 specs por aba |
| [[features/Importacao-Pagadores]] | Regras de importação de pagadores (CSV/XLSX) |
| [[features/Importacao-Boletos]] | Regras de importação de boletos — status, mês ref, deduplicação, desativação |
| [[features/Importacao-Faturas]] | Regras de importação de faturas de cartão (contratos + parcelas) |
| [[features/Importacao-CEPs]] | Regras de importação da base de CEPs |
| [[features/Match-Enderecos]] | Spec completa do match de endereços e telefones (/match-enderecos) |
| [[features/Advertencias]] | Spec completa do módulo de advertências de alunos (/advertencias) |

---

## Como usar com Claude

No início de cada sessão de desenvolvimento, forneça o contexto relevante ao Claude referenciando os documentos deste vault:

```
Leia docs/obsidian/00-visao-geral.md e docs/obsidian/04-regras-de-negocio.md antes de começar.
```

Para trabalhar em um módulo específico, referencie os documentos mais relevantes:

| Tarefa | Documentos para referenciar |
|--------|-----------------------------|
| Nova feature financeira | `04-regras-de-negocio`, `07-api-e-endpoints`, `08-estados-e-hooks` |
| Nova página ou rota | `05-telas-e-fluxos`, `02-estrutura-de-pastas`, `06-componentes` |
| Mudança em importação | `03-fluxo-de-dados`, `08-estados-e-hooks`, `10-debitos-tecnicos` |
| Integração externa | `09-integracoes`, `01-arquitetura` |
| Investigar bug | `03-fluxo-de-dados`, `07-api-e-endpoints`, feature spec relevante |
| Refatoração | `10-debitos-tecnicos`, `11-proximos-passos` |

Para criar spec de nova feature, use o template em `templates/` e salve em `features/Nome-Da-Feature.md`.

---

## Fluxo de documentação

### ANTES de implementar

1. Leia os documentos relevantes para o módulo que vai alterar
2. Verifique se as regras de negócio em [[04-regras-de-negocio]] refletem o que você vai implementar
3. Se a documentação estiver desatualizada, atualize-a **antes** de implementar (evita divergência)
4. Se for uma feature nova, crie a spec em `features/` primeiro

### DEPOIS de alterar

1. Atualize os documentos afetados pela mudança:
   - Nova tabela → atualizar [[07-api-e-endpoints]]
   - Novo hook → atualizar [[08-estados-e-hooks]]
   - Nova página → atualizar [[05-telas-e-fluxos]]
   - Nova regra de negócio → atualizar [[04-regras-de-negocio]]
   - Nova integração → atualizar [[09-integracoes]]
2. Registre a mudança em [[99-log-de-alteracoes]] com data, descrição e arquivos afetados
3. Se a mudança introduz débito técnico intencional, documente em [[10-debitos-tecnicos]]

> A documentação só tem valor se estiver sincronizada com o código. Atualizar docs é parte do definition of done.
