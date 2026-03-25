# Feature: Advertências de Alunos

**Página:** `/advertencias`
**Arquivo:** `src/pages/StudentWarnings.tsx`
**Componente de formulário:** `src/components/warnings/WarningDialog.tsx`
**Gerador de PDF:** `src/lib/warning-pdf.ts`
**Status:** Em produção

---

## Objetivo

Permite que coordenadores emitam advertências formais a alunos por descumprimento do regulamento de transporte (contrato Tavares 2026). O sistema registra o histórico no banco e gera um Termo Formal de Advertência imprimível para assinatura do aluno.

---

## Base legal (contrato Tavares 2026)

| Cláusula | Conteúdo |
|----------|----------|
| §3° | Proibições expressas (bebida, cigarro, som, armas, festinhas, barulho, brigas) |
| §4° | Brigas e desentendimentos = falta grave → advertência imediata |
| §5° | Conduta respeitosa e silenciosa obrigatória |
| §9° | Desrespeito a motoristas/coordenadores = infração grave |
| §10° | Ordem das penalidades: advertência verbal → advertência escrita → suspensão → exclusão |

---

## Tipos de infração

| Código | Label | Parágrafos |
|--------|-------|------------|
| `DESRESPEITO` | Desrespeito / Desacato | §2°, §5°, §9° |
| `BRIGAS` | Brigas e Tumulto | §3°, §4° |
| `BARULHO` | Barulho / Perturbação | §3°, §5° |
| `CONSUMO` | Consumo / Porte Proibido | §3° |
| `LIMPEZA` | Limpeza e Conservação | §7° |
| `ASSENTOS` | Assentos | §8°, §8-A |
| `OUTRO` | Outro (texto livre) | — |

---

## Penalidades

| Código | Label | Campos adicionais |
|--------|-------|-------------------|
| `ADVERTENCIA_ESCRITA` | Advertência Escrita | `numero_advertencia` (qual é essa: 1ª, 2ª…) |
| `SUSPENSAO` | Suspensão Temporária | `suspensao_dias`, `suspensao_data_inicio`, `suspensao_data_fim`, `suspensao_motivo` (REINCIDENCIA \| FALTA_GRAVE) |
| `EXCLUSAO` | Exclusão Definitiva | — |

---

## Tabela `student_warnings`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `aluno_nome` | text | Nome do aluno |
| `aluno_id` | uuid? | FK para `payers.id` (opcional) |
| `coordenador_nome` | text | Nome do coordenador emissor |
| `onibus_cor` | text? | Cor do ônibus |
| `data_ocorrencia` | date | Data da infração |
| `infracoes` | text[] | Array de códigos de infração |
| `outro_motivo` | text? | Texto livre para infração OUTRO |
| `gravidade` | LEVE_MODERADA \| GRAVE | — |
| `penalidade` | ADVERTENCIA_ESCRITA \| SUSPENSAO \| EXCLUSAO | — |
| `numero_advertencia` | integer? | Sequência da advertência escrita |
| `suspensao_dias` | integer? | Duração da suspensão |
| `suspensao_data_inicio` | date? | Data de início da suspensão |
| `suspensao_data_fim` | date? | Data de fim da suspensão |
| `suspensao_motivo` | REINCIDENCIA \| FALTA_GRAVE \| null | — |
| `observacoes` | text? | Texto livre adicional |

---

## Fluxo

1. Coordenador acessa `/advertencias`
2. Clica em **Nova Advertência** → abre `WarningDialog`
3. Preenche: aluno, coordenador, cor do ônibus, data, infrações (múltiplas), gravidade, penalidade e campos condicionais
4. Clica **Salvar e Imprimir**:
   - INSERT em `student_warnings`
   - Abre nova aba com o Termo Formal (HTML estilizado)
   - `window.print()` abre o diálogo de impressão do browser
5. Aluno assina o documento impresso
6. Histórico aparece na tabela da página com filtros por aluno/coordenador e penalidade

**Ação "Reimprimir":** Recria o PDF a partir dos dados salvos no banco, sem nova inserção.

---

## Geração do Termo (PDF)

Implementado em `src/lib/warning-pdf.ts` via `window.open() + window.print()` — sem dependência externa (mesmo padrão de `exportToPDF` em `export-utils.ts`).

**Estrutura do documento impresso:**
1. Cabeçalho: Tavares Transportes + título
2. Grid: data, ônibus, aluno, coordenador
3. Seção 1 — Infrações: tabela com ☑/☐ para cada tipo
4. Seção 2 — Penalidade: texto descritivo contextual (varia por tipo)
5. Seção 3 — Advertência final: texto padrão do regulamento
6. Observações (se preenchidas)
7. Linhas de assinatura: Aluno + Coordenador

---

## Melhorias possíveis

- [x] Autocompletar aluno a partir da tabela `payers` — combobox com busca carrega `status = 'ATIVO'`, popula `aluno_id` no INSERT
- [ ] Contador de advertências por aluno (indicar automaticamente se é 1ª, 2ª, etc.)
- [ ] Notificação WhatsApp ao aluno ao emitir advertência
- [ ] Exportar lista de advertências como CSV/Excel
