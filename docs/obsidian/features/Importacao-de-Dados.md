# Feature: Importação de Dados (índice)

**Página:** `/importar`
**Arquivo:** `src/pages/Import.tsx` (2050 linhas)
**Status:** Em produção, evoluindo

---

## Visão geral

A página `/importar` centraliza toda a entrada de dados em massa. Cada aba tem regras de negócio próprias documentadas em specs separadas.

| Aba | Spec | Hook | Tabela principal |
|-----|------|------|-----------------|
| Pagadores | [[Importacao-Pagadores]] | `useOptimizedImportPayers` | `payers` |
| Boletos | [[Importacao-Boletos]] | `useOptimizedImportBillings` | `billings` |
| Faturas | [[Importacao-Faturas]] | `useInvoiceImport` | `financial_entries` |
| CEPs | [[Importacao-CEPs]] | `useOptimizedImportCEPs` | `ceps` |
| Histórico | — | query `import_logs` | `import_logs` |

---

## Comportamentos comuns a todas as abas

- **Encoding:** UTF-8 com fallback automático para ISO-8859-1 se detectar garbling
- **Notação científica Excel** (ex: CPFs como `4,62E+10`): normalizado sem perda de precisão via `decimal.js`
- **Auditoria:** todo import gera um `import_log` com `run_id`, `diff_summary` e até 100 detalhes de erros
- **Progress bar:** atualizado durante o processamento em batches
- **Histórico:** aba Histórico exibe todos os `import_logs` com resumo e possibilidade de rollback (rollback ainda não implementado)

---

## Libs de parse

| Lib | Uso |
|-----|-----|
| `papaparse` | Parse de CSV |
| `xlsx` | Parse de XLSX |
| `decimal.js` | Normalização de notação científica para CPF/telefone |
| `src/lib/csv-import.ts` | Transformação de linhas (CPF, CEP, telefone E.164, datas, moeda) |
| `src/lib/invoice-import.ts` | Parse heurístico de faturas de cartão |
