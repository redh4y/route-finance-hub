# Feature: Importação de Faturas de Cartão

**Página:** `/importar` → aba Faturas
**Hook:** `src/hooks/useInvoiceImport.ts` → `useInvoiceImport`
**Parse:** `src/lib/invoice-import.ts` → `parseInvoiceSheet()` + `buildContractsAndExpenses()`
**Tabelas destino:** `installment_contracts` + `financial_entries`
**Batch size:** 100

---

## Objetivo

Importar faturas de cartão de crédito (Sicredi ou genérico), criando contratos de parcelamento e lançando as parcelas futuras como despesas previstas e as parcelas passadas como despesas reais no DRE.

---

## Formato do arquivo

Não há um formato fixo de colunas. O parser (`parseInvoiceCsvRobust`) lê linha a linha e identifica campos por heurística:

- **Data:** primeira célula que casa com `DD/MM/YYYY`
- **Descrição:** primeira célula não vazia após a data
- **Parcelas:** célula que casa com o padrão `01/03` (atual/total)
- **Valor:** última célula numérica válida da linha (tenta da direita para a esquerda)
- **Linhas ignoradas:** descrição normalizada contém `"pag fat deb cc"` (pagamento de fatura — não é despesa)

O `parseInvoiceSheet` adicionalmente extrai do cabeçalho da planilha:
- `invoiceDueDate` — linha com `"data de vencimento"`
- `cardLast4` — primeiros 16–19 dígitos encontrados (número do cartão)

---

## Regras de negócio

### 1. Identificação do contrato de parcelamento

Cada linha da fatura que tem parcelas gera (ou reutiliza) um `installment_contract`. A chave é um hash (`cyrb53`) de:

```
{cardId}|{descricao_normalizada}|{data_compra}|{valor_cents}|{total_parcelas}
```

Se a mesma compra parcelada aparecer em faturas de meses diferentes → **mesmo contrato** (upsert por `id`). Isso evita duplicar o contrato ao reimportar.

### 2. Geração de parcelas (expenses)

Para cada contrato, são geradas `installment_total` parcelas:

- **`competence_month`:** mês de competência de cada parcela
  - Calculado a partir do mês da compra + `i - 1` meses
  - Se `purchaseDate.day > closingDay` (padrão: 9) → primeira competência = mês seguinte ao da compra
- **`status`:**
  - `competence_month <= invoiceMonthOverride` → `REAL`
  - `competence_month > invoiceMonthOverride` → `PREVISTO`
- **Nunca rebaixa `REAL` → `PREVISTO`:** se a parcela já existir como `REAL` no banco e o import tentar `PREVISTO`, mantém `REAL`

### 3. Preservação de classificação existente

Se a parcela já existe no banco com `group_id` preenchido:
- `category`, `subcategory`, `type`, `group_id`, `subgroup_id` → mantém os valores já classificados
- `needs_classification = false`, `needs_review = false`

Se não existe ou não tem classificação:
- `needs_classification = true`, `needs_review = true`
- `review_reasons: ["MISSING_GROUP"]`

### 4. IDs determinísticos

Tanto contratos (`id`) quanto parcelas (`expense_id`) usam hash `cyrb53` — não UUIDs aleatórios. Isso garante idempotência: importar o mesmo arquivo duas vezes não duplica dados.

### 5. Campos fixos em `financial_entries`

| Campo | Valor fixo |
|-------|-----------|
| `type` | `DESPESA` |
| `source` | `FATURA` |
| `payment_method` | `CARTAO_CREDITO` |
| `date` | `purchaseDate` (data da compra) |
| `operation_date` | `purchaseDate` |

### 6. Parâmetros configuráveis no UI

| Parâmetro | Padrão | Significado |
|-----------|--------|------------|
| `provider` | `sicredi` | Formato do extrato (`sicredi` ou `generic`) |
| `closingDay` | `9` | Dia de fechamento da fatura |
| `dueDay` | `15` | Dia de vencimento da fatura |
| `invoiceMonthOverride` | — | Mês da fatura (obrigatório) |
| `costCenterCode` | `GERAL` | Centro de custo |
| `category` | `CARTAO_CREDITO` | Categoria inicial |

### 7. Diferença entre providers

| Comportamento | `sicredi` | `generic` |
|-------------|-----------|-----------|
| Data base do contrato | `purchaseDate` original | `purchaseDate - (installment_current - 1) meses` |

O provider `generic` reconstrói a data da compra original a partir da parcela atual.

---

## Diff summary (import_log)

```json
{
  "contracts": N,
  "expenses": N,
  "parsed": N      // linhas válidas no CSV
}
```

Não há `error_rows` — qualquer erro lança exceção e aborta o import inteiro (sem fallback linha a linha).

---

## Melhorias possíveis

- [ ] Fallback linha a linha em caso de erro (hoje abort total)
- [ ] Preview das parcelas antes de confirmar
- [ ] Suporte a outros providers (Nubank, Bradesco, etc.)
- [ ] `import_log` com `error_rows` real (hoje sempre `0`)
