# Feature: Importação de CEPs

**Página:** `/importar` → aba CEPs
**Hook:** `src/hooks/useOptimizedImport.ts` → `useOptimizedImportCEPs`
**Parse:** `src/lib/csv-import.ts` → `transformCEPRow()`
**Tabela destino:** `ceps`
**Conflito:** `cep` (upsert)
**Batch size:** 500

---

## Objetivo

Popular ou atualizar a base local de CEPs usada pelo sistema de matching de endereços (`/admin/address-match`). Serve como fonte de referência para validar e enriquecer os endereços dos pagadores durante a importação.

---

## Colunas esperadas no CSV

| Coluna | Campo destino | Notas |
|--------|--------------|-------|
| `CEP` ou `cep` | `cep` | Normalizado para 8 dígitos (remove hífen, padStart) |
| `Logradouro` | `logradouro` | — |
| `Bairro` | `bairro` | — |
| `Cidade` | `cidade` | Alternativa à coluna `Localidade` |
| `UF` | `uf` | Alternativa à coluna `Localidade` |
| `Localidade` | `cidade` + `uf` | Formato: `"Guaíra / SP"` ou `"Guaíra - SP"` |

---

## Regras de negócio

### 1. Validação do CEP

- Remove todos os não-dígitos
- CEP válido = exatamente 8 dígitos após normalização
- Linhas com CEP inválido são descartadas silenciosamente

### 2. Coluna `Localidade` (formato combinado)

Suporta colunas no formato `"Cidade / UF"` ou `"Cidade - UF"`:
- Divide pelo separador `/` ou `-`
- Último segmento → `uf`
- Primeiro segmento → `cidade`
- Se `Cidade` e `UF` explícitas existirem, têm **prioridade** sobre `Localidade`

### 3. Deduplicação

Upsert com `onConflict: "cep"` — reimportar o mesmo arquivo atualiza os dados sem duplicar.

### 4. Processamento em batch

- Batch de 500 CEPs por vez
- Se um batch falha → todos os CEPs do batch são contados como erro (sem fallback individual)
- Progress bar atualizado por batch

---

## Diff summary (import_log)

```json
// Não há diff_summary para CEPs — apenas status COMPLETED/FAILED
// success_rows e error_rows são gravados
```

---

## Melhorias possíveis

- [ ] Fallback individual quando batch falha (hoje perde o batch inteiro)
- [ ] Suporte a formato IBGE (arquivo oficial de CEPs com colunas diferentes)
- [ ] Diff summary mostrando inseridos vs. atualizados
