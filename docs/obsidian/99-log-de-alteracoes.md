# Log de Alterações

## Como usar este arquivo

Registre **toda** mudança significativa de feature, regra de negócio ou decisão técnica neste log.

**Quando registrar:**
- Ao implementar ou alterar uma feature (mesmo que parcialmente)
- Ao mudar uma regra de negócio (ex: novo status, novo campo obrigatório)
- Ao refatorar um módulo inteiro
- Ao adicionar ou remover uma integração externa
- Ao criar ou alterar uma Edge Function
- Ao executar uma migração de banco que muda comportamento

**Quando NÃO é necessário:**
- Pequenas correções de UI (cor, espaçamento)
- Typos em labels
- Ajustes de padding/margin sem impacto funcional

---

## Formato da entrada

```
### YYYY-MM-DD — Título curto

- **O que mudou:** descrição objetiva do que foi alterado
- **Arquivos afetados:** lista de arquivos modificados
- **Motivo:** por que a mudança foi feita
```

---

## Entradas

---

### 2026-03-20 — Pendências de download: botões icon-only com tooltip

- **O que mudou:** Os três botões de contato por linha (Aviso de emissão, Enviar link, Avisar vencimento) passaram a exibir apenas o ícone (`Info` / `Link` / `Clock`). O texto do botão tornou-se tooltip ao hover, usando `TooltipProvider` + `Tooltip` + `TooltipTrigger` do shadcn/ui
- **Arquivos afetados:** `src/pages/BoletoAccessLogs.tsx`
- **Motivo:** Reduzir a largura da coluna "Contato" na tabela de pendências sem perder a descoberta da ação

---

### 2026-03-20 — Pendências de download: filtro ATIVO + não pago + botão individual de vencimento

- **O que mudou:**
  - Tabela de pendências agora exibe **apenas** pagadores `status = 'ATIVO'` que ainda não têm `billing.status = 'PAID'` no mês vigente (cross-reference via `billings.payer_id`)
  - Status padrão do filtro alterado para **"Não pago"** (antes era "Todos")
  - Adicionado botão individual `Clock` ("Avisar vencimento") por linha, além dos já existentes `Info` e `Link`
  - Ícones específicos por tipo de botão: `Info` para aviso de emissão, `Link` para envio de link, `Clock` para vencimento
- **Arquivos afetados:** `src/pages/BoletoAccessLogs.tsx`
- **Motivo:** A lista incluía alunos inativos e pagadores que já haviam quitado o boleto; operadores precisavam de ação de lembrete individual de vencimento por linha

---

### 2026-03-20 — Pendências de download: correção de fuso e mensagens WhatsApp revisadas

- **O que mudou:**
  - Datas do tipo `YYYY-MM-DD` agora são parseadas via `parseDateLocal` (local noon) — elimina rollback de dia em UTC-3 (ex: 23/03 aparecia como 22/03)
  - Mensagens de WhatsApp revisadas: sem emojis, rodapé automático `_Caso já tenha efetuado o pagamento, desconsidere esta mensagem._` em todas
  - Aviso de vencimento calcula dinamicamente `hoje - due_date` para exibir "faltam X dias" ou "venceu há X dias"; inclui link direto do boleto quando disponível
- **Arquivos afetados:** `src/pages/BoletoAccessLogs.tsx`, `docs/obsidian/features/Portal-2a-Via-Boletos.md`
- **Motivo:** Datas de vencimento em UTC geravam confusão operacional; mensagens com emojis inconsistentes e sem rodapé automático geravam retrabalho manual

---

### 2026-03-20 — Match de endereços: limpa needs_review ao confirmar atualização com match_ok

- **O que mudou:** Quando `confirmUpdatePayers` aplica uma atualização com `match_ok = true`, o campo `needs_review` é forçado para `false` no payload. Remove a flag de pagador temporário ao confirmar que o endereço foi processado com sucesso
- **Arquivos afetados:** `src/pages/AddressMatch.tsx`
- **Motivo:** Pagadores placeholder criados durante importação de boletos continuavam com `needs_review: true` mesmo após endereço atualizado com sucesso no match

---

### 2026-03-20 — Importação de pagadores: limpa needs_review ao atualizar placeholder

- **O que mudou:** Quando a importação de pagadores encontra um pagador já existente no banco (match por CPF ou código), força `needs_review: false` no upsert. Remove automaticamente a flag de pagador temporário criada durante a importação de boletos (`IMPORT_BILLING_SEM_CADASTRO`), sem afetar `review_flag`/`review_reason` do CSV atual
- **Arquivos afetados:** `src/hooks/useOptimizedImport.ts`, `docs/obsidian/features/Importacao-Pagadores.md`
- **Motivo:** Pagadores criados como placeholder por boletos importados continuavam com `needs_review: true` mesmo depois de ter seus dados completos importados via CSV

---

### 2026-03-20 — Advertências: suspensão com intervalo de datas (início + fim)

- **O que mudou:** Campo `suspensao_data` renomeado para `suspensao_data_inicio`; adicionado `suspensao_data_fim`. O formulário agora exibe dois date-pickers lado a lado para o período. O PDF exibe "DD/MM/AAAA até DD/MM/AAAA". Migration: `20260320140000_add_suspensao_data_fim.sql`
- **Arquivos afetados:** `supabase/migrations/20260320140000_add_suspensao_data_fim.sql`, `src/lib/warning-pdf.ts`, `src/components/warnings/WarningDialog.tsx`, `src/pages/StudentWarnings.tsx`, `docs/obsidian/features/Advertencias.md`
- **Motivo:** Uma suspensão cobre um intervalo de dias, não uma data única

---

### 2026-03-20 — Advertências: aluno via combobox de pagadores ativos + redesign do dialog

- **O que mudou:** Campo "Aluno(a)" no `WarningDialog` alterado de input livre para combobox com busca que carrega pagadores `status = 'ATIVO'` do banco. Seleção popula `aluno_id` no INSERT. Redesign do dialog: seções separadas por `Separator`, header e footer com fundo destacado, infrações com `divide-y` ao invés de `space-y`, campos condicionais de suspensão agrupados em card `bg-muted/40`, contador de infrações selecionadas no rodapé
- **Arquivos afetados:** `src/components/warnings/WarningDialog.tsx`, `docs/obsidian/features/Advertencias.md`
- **Motivo:** Campo livre não garantia vínculo com o banco e a UI estava visualmente desorganizada

---

### 2026-03-20 — Módulo de Advertências de Alunos criado

- **O que mudou:** Novo módulo para emitir e registrar advertências por descumprimento do regulamento de transporte (contrato Tavares 2026). Inclui: tabela `student_warnings` no banco, gerador de PDF via `window.print()` com Termo Formal de Advertência, dialog de formulário com todos os campos do regulamento (infrações, gravidade, penalidade, suspensão), página `/advertencias` com histórico filtrável e botão "Reimprimir", e link no sidebar
- **Arquivos afetados:** `supabase/migrations/20260320130000_create_student_warnings.sql`, `src/lib/warning-pdf.ts`, `src/components/warnings/WarningDialog.tsx`, `src/pages/StudentWarnings.tsx`, `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `docs/obsidian/features/Advertencias.md`
- **Motivo:** Coordenadores precisavam de um meio formal para emitir advertências, registrar reincidências e imprimir o termo para assinatura do aluno, conforme previsto no §10° do contrato

---

### 2026-03-20 — Aliases de bairro movidos para banco de dados

- **O que mudou:** Os 27 aliases hardcoded em `_mapBairroAlias()` foram migrados para a tabela `bairro_aliases` no banco. O engine agora aceita aliases como parâmetro opcional (`aliases?: BairroAlias[]`) em `processRow` e `processAllRows`. Em `AddressMatch.tsx`, os aliases são carregados do banco ao montar a página e passados ao engine. Um card "Aliases de Bairro" foi adicionado à página com UI para adicionar e remover aliases sem deploy. O código hardcoded permanece como fallback se o banco estiver vazio
- **Arquivos afetados:** `src/lib/address-match-engine.ts`, `src/pages/AddressMatch.tsx`, `supabase/migrations/20260320120000_create_bairro_aliases.sql`, `docs/obsidian/features/Match-Enderecos.md`
- **Motivo:** Quando um bairro novo aparecer (como "ANICETO"), o operador pode adicionar o alias diretamente na UI sem aguardar deploy. Elimina dependência de desenvolvedor para manutenção de dados de domínio

---

### 2026-03-20 — Phone match: detecção de telefone compartilhado entre contatos

- **O que mudou:** `readJsonContacts` agora detecta quando o mesmo número de telefone está salvo sob nomes diferentes no WhatsApp. O campo `phone_shared_with` é preenchido com os outros nomes. Na tabela de resultados de telefones em `/match-enderecos`, linhas com telefone compartilhado são destacadas em laranja com aviso dos outros nomes
- **Arquivos afetados:** `src/lib/phone-match-engine.ts`, `src/pages/AddressMatch.tsx`
- **Motivo:** Um mesmo número pode pertencer a dois pagadores diferentes (ex: mãe e filho) — sem esse alerta o operador não saberia que o match pode estar errado

---

### 2026-03-20 — Phone match: phone_final sempre normalizado para E.164

- **O que mudou:** `phone_final` agora sempre retorna no formato `+55XXXXXXXXXXX` em todos os status (`TELEFONE_SECUNDARIO`, `ABAIXO_THRESHOLD`, `SEM_MATCH`). Antes preservava o telefone bruto do CSV sem normalizar
- **Arquivos afetados:** `src/lib/phone-match-engine.ts`
- **Motivo:** Telefones sem `+55` no CSV geravam falsos positivos no preview de alterações e valores inconsistentes no banco; `wa.me` e o sistema inteiro exigem o código de país

---

### 2026-03-20 — Match de endereços: provider_id dinâmico

- **O que mudou:** `importContactsToDb` em `AddressMatch.tsx` passou a buscar o provider WhatsApp ativo no banco (`whatsapp_providers WHERE active = true`) em vez de usar `provider_id` e `instance_name` hardcoded
- **Arquivos afetados:** `src/pages/AddressMatch.tsx`
- **Motivo:** Se a instância do WhatsApp mudar, os contatos seriam gravados na provider errada sem nenhum erro visível

---

### 2026-03-20 — Spec de Match de Endereços criada

- **O que mudou:** Criada feature spec completa para `/match-enderecos` em `docs/obsidian/features/Match-Enderecos.md`, documentando os dois engines (endereço e telefone), todos os thresholds, aliases de bairro hardcoded, status de match e fluxo de atualização no banco
- **Arquivos afetados:** `docs/obsidian/features/Match-Enderecos.md`, `docs/obsidian/Home.md`
- **Motivo:** Pré-requisito do fluxo de documentação; engines têm lógica complexa que não estava documentada em nenhum lugar

---

### 2026-03-20 — Specs de importação separadas por aba

- **O que mudou:** Spec `Importacao-de-Dados.md` convertida em índice; criadas 4 specs individuais com regras extraídas diretamente do código: `Importacao-Pagadores.md`, `Importacao-Boletos.md`, `Importacao-Faturas.md`, `Importacao-CEPs.md`
- **Arquivos afetados:** `docs/obsidian/features/Importacao-de-Dados.md`, `Importacao-Pagadores.md`, `Importacao-Boletos.md`, `Importacao-Faturas.md`, `Importacao-CEPs.md`, `docs/obsidian/Home.md`
- **Motivo:** Cada aba tem regras de negócio independentes; specs separadas facilitam consulta e manutenção

---

### 2026-03-20 — Spec de importação de dados criada

- **O que mudou:** Criada feature spec completa para a página `/importar` em `docs/obsidian/features/Importacao-de-Dados.md`, documentando as regras exatas de importação de boletos extraídas diretamente do código (`useOptimizedImport.ts`, `csv-import.ts`)
- **Arquivos afetados:** `docs/obsidian/features/Importacao-de-Dados.md`, `docs/obsidian/Home.md`
- **Motivo:** Pré-requisito do fluxo de documentação antes de evoluir o módulo de importação; regras de negócio estavam apenas no código

---

### 2026-03-20 — Pendências de download — busca, filtro, sem número e export CSV

- **O que mudou:**
  - Busca por nome ou CPF dentro da tabela de pendências (filtragem em tempo real, client-side)
  - Filtro por status: Todos / Consultou / Não acessou
  - Badge "X sem número" no cabeçalho indicando quantos pendentes não têm WhatsApp
  - Badge "X filtrados" aparece quando a busca/filtro reduz a lista total
  - Botão "Exportar CSV" que baixa a lista **filtrada** com: Nome, CPF, Telefone, Status, Último acesso, Vencimento (BOM UTF-8 para Excel)
  - Mensagem de "nenhum resultado" quando filtros não retornam pendências
- **Arquivos afetados:** `src/pages/BoletoAccessLogs.tsx`, `docs/obsidian/features/Portal-2a-Via-Boletos.md`
- **Motivo:** Com 272+ pendentes, encontrar um aluno específico era impossível sem scroll; o export viabiliza trabalhar fora do sistema (WhatsApp Business, planilhas)

---

### 2026-03-20 — Obsidian vault criado

- **O que mudou:** Estrutura inicial do vault Obsidian criada com Glossário, ADR-001 e feature spec do portal 2ª via
- **Arquivos afetados:** `docs/obsidian/Home.md`, `docs/obsidian/dominio/Glossario.md`, `docs/obsidian/decisoes/ADR-001-url-boleto.md`, `docs/obsidian/features/Portal-2a-Via-Boletos.md`
- **Motivo:** Criação do segundo cérebro do projeto para centralizar contexto que não cabe no código

---

### 2026-03-20 — Portal 2ª via — melhorias de UX e operação batch

- **O que mudou:**
  - Adicionados botões de ação batch: "Aviso emissão", "Enviar link", "Aviso vencimento"
  - Layout de pendências de download reformatado como tabela (antes era lista)
  - Encoding de emojis nas mensagens WhatsApp corrigido (UTF-8 no URL)
  - Destaque visual ao clicar em botão de WhatsApp (feedback de ação executada)
- **Arquivos afetados:** `src/pages/BoletoAccessLogs.tsx`
- **Motivo:** Operadores relataram dificuldade em contatar múltiplos inadimplentes de forma eficiente; a tabela melhora a leitura e o batch reduz cliques

---

### 2026-03-20 — Documentação completa do sistema criada

- **O que mudou:** Análise profunda do projeto e geração dos arquivos de documentação 00 a 11 no vault Obsidian. Cobre: visão geral, arquitetura, estrutura de pastas, fluxos de dados, regras de negócio, telas, componentes, API/endpoints, estado/hooks, integrações, débitos técnicos e roadmap
- **Arquivos afetados:**
  - `docs/obsidian/00-visao-geral.md`
  - `docs/obsidian/01-arquitetura.md`
  - `docs/obsidian/02-estrutura-de-pastas.md`
  - `docs/obsidian/03-fluxo-de-dados.md`
  - `docs/obsidian/04-regras-de-negocio.md`
  - `docs/obsidian/05-telas-e-fluxos.md`
  - `docs/obsidian/06-componentes.md`
  - `docs/obsidian/07-api-e-endpoints.md`
  - `docs/obsidian/08-estados-e-hooks.md`
  - `docs/obsidian/09-integracoes.md`
  - `docs/obsidian/10-debitos-tecnicos.md`
  - `docs/obsidian/11-proximos-passos.md`
  - `docs/obsidian/99-log-de-alteracoes.md`
  - `docs/obsidian/Home.md` (atualizado)
- **Motivo:** Criar fonte de verdade centralizada do sistema para onboarding, manutenção e uso como contexto em sessões com Claude

---
