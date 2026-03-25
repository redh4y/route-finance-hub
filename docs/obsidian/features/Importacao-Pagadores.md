# Feature: Importação de Pagadores

**Página:** `/importar` → aba Pagadores
**Hook:** `src/hooks/useOptimizedImport.ts` → `useOptimizedImportPayers`
**Parse:** `src/lib/csv-import.ts` → `transformPayerRow()`
**Tabela destino:** `payers`
**Batch size:** 200

---

## Objetivo

Importar ou atualizar em massa o cadastro de alunos/pagadores a partir de CSV ou XLSX gerado pelo sistema de gestão ou por ferramentas de pré-processamento de endereços.

---

## Colunas esperadas no CSV

| Coluna | Campo destino | Notas |
|--------|--------------|-------|
| `Nome` | `name` | Obrigatório |
| `Identif` | `document_digits` | CPF normalizado para 11 dígitos |
| `Cod Pagador` | `payer_code` | Alternativa ao CPF para identificação |
| `Endereco` | `address_original` | Endereço bruto original |
| `CEP` | `cep` (fallback) | Usado se `matched_cep` ausente |
| `Cidade` | `city` (fallback) | Usado se `matched_cidade` ausente |
| `UF` | `state` (fallback) | Usado se `matched_uf` ausente |
| `Telefone` | `phone` | Normalizado para E.164 (+55...) |
| `Telefone_secundario` | `extra_contacts[0]` | Gravado em array JSON |
| `Email` | `email` | — |
| `match_ok` | — | `true/false`; controla se endereço processado é aplicado |
| `matched_logradouro` | `street` | Só aplicado se `match_ok = true` |
| `parsed_numero` / `matched_numero` | `number` | Tenta `parsed_numero` primeiro |
| `matched_bairro` | `neighborhood` | — |
| `matched_cep` | `cep` | — |
| `matched_cidade` | `city` | — |
| `matched_uf` | `state` | — |
| `matched_full` / `matched_endereco_completo` | `address_base` | — |
| `review_status` | `review_status` | Repassado diretamente |
| `review_reason` | `review_reason` | Repassado diretamente |

---

## Regras de negócio

### 1. Identificação do pagador existente

Prioridade: **CPF (`document_digits`) > `payer_code`**

- Se o CPF encontrar **mais de um** pagador no banco → erro `AMBIGUOUS (CPF)`
- Se o código encontrar **mais de um** → erro `AMBIGUOUS (Cod Pagador)`
- Se CPF aponta para pagador A e código aponta para pagador B (diferentes) → erro `CONFLICT`
- Sem match → novo pagador (INSERT com novo UUID)
- Com match único → reutiliza o ID encontrado (UPDATE via upsert em `id`)

### 2. Linha inválida

Descartada (sem inserir erro no banco) se:
- `Nome` ausente ou vazio, **e**
- `document_digits` e `payer_code` ambos ausentes

### 3. Endereço: aplicação condicional

- Se `match_ok = true` → grava `street`, `number`, `neighborhood`, `cep`, `city`, `state`, `address_base` a partir dos campos `matched_*`
- Se `match_ok = false` → grava apenas os dados base (`name`, `document_digits`, `phone`, etc.) sem sobrescrever endereço

### 4. Flag de revisão

`review_flag = true` se **qualquer** das condições:
- `match_ok = false`
- `review_status = "REVIEW"`
- `review_reason` contém `"AMBIGUO_TOP2_PROXIMO"`

### 5. Contato secundário

Se `Telefone_secundario` presente → gravado em `extra_contacts: [{ type: "phone", value: "+55..." }]`

### 6. Limpeza de flag de placeholder

Quando o upsert **atualiza** um pagador existente (match por CPF ou código), o campo `needs_review` é forçado para `false`. Isso remove automaticamente a flag de "pagador temporário" criada pela importação de boletos (`review_reason = IMPORT_BILLING_SEM_CADASTRO`). Os campos `review_flag` e `review_reason` ainda podem ser `true`/não-nulos se o próprio CSV indicar necessidade de revisão (endereço não processado, AMBIGUO, etc.).

### 7. Deduplicação no CSV

Se o mesmo pagador (mesmo `id` resolvido) aparecer **mais de uma vez** no arquivo → mantém apenas a **última ocorrência**. A contagem de duplicatas é registrada em `errorDetails` como aviso.

### 8. Processamento

- Batch de 200 por vez (upsert em `id`)
- Se o batch falha → fallback para inserção linha a linha
- Progress bar atualizado por batch concluído

---

## Diff summary (import_log)

```json
{
  "inserted": N,   // IDs que não existiam antes
  "updated": N,    // IDs já existentes no banco
  "skipped": N,    // duplicatas consolidadas do CSV
  "errors": N
}
```

---

## Melhorias possíveis

- [ ] Preview de pagadores (NEW / UPDATE / NO_CHANGE / AMBIGUOUS / CONFLICT) antes de confirmar — padrão já existe na UI, mas os tipos estão definidos e não totalmente conectados ao hook
- [ ] Exibir lista de pagadores que serão desativados antes de confirmar (quando vinculado a import de boletos)
- [ ] Validação de CPF duplicado dentro do próprio CSV antes de enviar ao banco
