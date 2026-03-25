# Feature: Importação de Boletos

**Página:** `/importar` → aba Boletos
**Hook:** `src/hooks/useOptimizedImport.ts` → `useOptimizedImportBillings`
**Parse:** `src/lib/csv-import.ts` → `transformBillingRow()`
**Tabela destino:** `billings` + efeitos em `payers`
**Batch size:** insert 100 | update individual | payers 200

---

## Objetivo

Importar o extrato mensal de cobranças do banco (boletos emitidos, pagos e cancelados) para o sistema. Além de criar/atualizar os registros de boletos, a importação atualiza o status dos pagadores e desativa automaticamente quem não aparece no extrato do mês.

---

## Colunas esperadas no CSV

| Coluna | Campo destino | Notas |
|--------|--------------|-------|
| `Nosso Numero` | `nosso_numero` | Identificador bancário do boleto |
| `Seu Numero` | `seu_numero` | Referência interna; `ANT`/`ANTERIOR` = reemissão |
| `Cod Pagador` | `payer_code` | Código interno do aluno |
| `Cpf/Cnpj Pagador` / `Identif` / `Identificacao` | `document_digits` | CPF — normalizado para 11 dígitos |
| `Data Vencimento` | `due_date` | `DD/MM/YYYY` ou `YYYY-MM-DD` |
| `Data Baixa` | `liquidation_at` | Presente = cancelamento |
| `Data Pagamento` | `settlement_at` | Presente = pagamento |
| `Valor` / `Valor Titulo` / `Valor Documento` | `amount_expected_cents` | Tenta em ordem; remove `R$`, pontos e vírgula |
| `Nome Pagador` / `Nome` | `payer_name` | Usado só para criar placeholders |

---

## Regras de negócio

### 1. Determinação do status do boleto

| `Data Baixa` | `Data Pagamento` | Status |
|-------------|-----------------|--------|
| Presente | Presente | `NEEDS_REVIEW` |
| Ausente | Presente | `PAID` |
| Presente | Ausente | `CANCELADO` |
| Ausente | Ausente | `OPEN` |

### 2. Mês de referência

- **Regra geral:** mês da `Data Vencimento`
- **Exceção — vencimento até dia 10:** mês anterior ao vencimento
  *(ex: vencimento 05/03 → reference_month = 2024-02)*
- **Exceção — reemissão:** `Seu Numero` contém `ANT` ou `ANTERIOR` → mês anterior
- **Sem vencimento:** mês atual do sistema

### 3. Identificação do pagador

Prioridade: **CPF > `Cod Pagador`**

Se **nenhum match** no banco → cria **pagador temporário (placeholder)**:

| Campo | Valor |
|-------|-------|
| `name` | `Nome Pagador` / `Nome` do CSV — ou `"Pagador {código}"` |
| `status` | `ATIVO` |
| `billing_mode` | `BOLETO` |
| `needs_review` | `true` |
| `review_flag` | `true` |
| `review_status` | `REVIEW` |
| `review_reason` | `IMPORT_BILLING_SEM_CADASTRO` |
| `default_route` | `FRANCA` (valor > R$500) ou `BARRETOS` |
| `birth_date` | `null` |
| Contato, endereço | tudo `null` |

### 4. Chave de identidade do boleto

Usada para deduplicar dentro do CSV e para buscar registros existentes no banco:

| Condição | Chave base | Chave completa (com status) |
|---------|-----------|----------------------------|
| Tem `nosso_numero` | `payer\|ref\|NN\|{nosso}` | `...\|ST\|{status}` |
| Tem `seu_numero` ou `due_date` | `payer\|ref\|SD\|{seu}\|{due}` | `...\|ST\|{status}` |
| Fallback | `payer\|ref\|FALLBACK` | `...\|ST\|{status}` |

Duplicatas no CSV com mesma chave completa → mantém apenas a de **maior prioridade de status**.

### 5. Prioridade de status

```
PAID (3) > OPEN (2) > NEEDS_REVIEW (1) > CANCELADO (0)
```

### 6. Resolução de conflito com registros existentes no banco

| Situação no banco | CSV traz | Ação |
|-------------------|---------|------|
| Mesmo status, dados diferentes (`due_date`/`nosso_numero`/`seu_numero`) | qualquer | **Atualizar** registro |
| `OPEN` sem `PAID` | `CANCELADO` | **Atualizar** OPEN → CANCELADO |
| Sem `PAID`, tem OPEN ou CANCELADO | `PAID` ou `OPEN` | **Atualizar** existente → novo status |
| Sem `PAID`, sem existente | `PAID` ou `OPEN` | **Inserir** novo |
| Já tem `PAID` | `OPEN` | **Ignorar** (não rebaixa) |
| Nenhuma das acima | qualquer | **Inserir** nova variante |

### 7. Efeitos colaterais no pagador

Para cada pagador processado no import:
- `billing_seen_in_month` → mês do boleto
- `last_billing_ref` → mês do boleto
- `status` → `ATIVO`
- `billing_mode` → `BOLETO`
- `default_route` → `FRANCA` (valor > R$500) ou `BARRETOS`
- Se `PAID` → `last_payment_at` = `settlement_at` (ou `due_date`)
- Se `NEEDS_REVIEW` ou cancelamento rápido → `needs_review = true`

**Cancelamento rápido:** `Data Baixa` ocorreu ≤ 10 dias após o vencimento → `needs_review = true` no pagador.

### 8. Desativação de pagadores ausentes no import

Ao final, todos os pagadores **ativos** que **não aparecerem** no CSV são desativados — **exceto:**

| Condição | Comportamento |
|---------|--------------|
| `is_coordinator = true` | Nunca desativa |
| `manual_active_until >= referenceMonth` | Mantém ativo |
| `billing_mode = PIX_ONLY` | Não desativa |
| `billing_mode = MIXED` | Não desativa, seta `needs_review = true` |

Pagadores com status `CANCELADO` no CSV → `INATIVO`
Pagadores com status `PAID` ou `OPEN` no CSV → garante `ATIVO`

### 9. Rota de reemissão

Se `seu_numero` contém `ANT`/`ANTERIOR` → `route = "REEMISSAO"`, caso contrário `route = "BOLETO"`.

---

## Processamento em etapas

| Etapa | % progresso |
|-------|------------|
| Parse e deduplicação do CSV | 0–30% |
| Criação de placeholders | 30–40% |
| Insert de novos boletos (batch 100) | 40–70% |
| Update de boletos existentes (individual) | 70–85% |
| Update de pagadores (batch 200, paralelo) | 85–95% |
| Desativação de ausentes + log | 95–100% |

Fallback: se batch de insert falhar → reprocessa linha a linha.

---

## Diff summary (import_log)

```json
{
  "new_billings": N,
  "updated_billings": N,
  "new_payers": N,       // placeholders criados
  "payer_updates": N,    // pagadores que tiveram campos alterados
  "errors": N
}
```

---

## Melhorias possíveis

- [ ] Preview antes de confirmar (igual aba Pagadores) mostrando NEW / UPDATE / CANCELADO / etc.
- [ ] Aviso explícito "X pagadores serão desativados" antes de confirmar
- [ ] Rollback via `run_id` (log já existe; operação não implementada)
- [ ] `review_reason` explícito para cancelamentos rápidos (`QUICK_CANCELLATION`)
- [ ] `review_reason` explícito para `NEEDS_REVIEW` por baixa+pagamento simultâneos
- [ ] Threshold do dia ≤ 10 tornando-se configurável (hoje hardcoded em `csv-import.ts:184`)
