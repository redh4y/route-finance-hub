# Feature: Match de Endereços & Telefones

**Página:** `/match-enderecos`
**Arquivo:** `src/pages/AddressMatch.tsx` (1624 linhas)
**Engine de endereço:** `src/lib/address-match-engine.ts`
**Engine de telefone:** `src/lib/phone-match-engine.ts`
**Status:** Em produção

---

## Objetivo

Ferramenta de pré-processamento de dados: recebe um CSV de pagadores com endereços em texto livre e um JSON de contatos WhatsApp, e produz um CSV enriquecido com endereço normalizado (rua, bairro, CEP, cidade, UF) e telefone validado. O resultado pode ser exportado e/ou gravado diretamente no banco.

Essa página é usada antes da importação de pagadores — o CSV gerado aqui alimenta a aba Pagadores de `/importar`.

---

## Entradas

| Arquivo | Obrigatório | Formato |
|---------|------------|---------|
| CSV de pagadores | Sim | CSV com colunas configuráveis pelo operador |
| Base de CEPs | Não | CSV com `CEP, Logradouro, Bairro, Cidade, UF` — complementa a base do banco |
| JSON de contatos WhatsApp | Não | Export da Evolution API — array de contatos com `saved_name`, `phone_number` |

**Colunas configuráveis pelo operador** (selecionadas via dropdown após upload):
- Coluna de endereço (padrão: `Endereco`)
- Coluna de telefone (padrão: `Telefone`)
- Coluna de nome (padrão: `Nome`)
- Coluna de CPF/identificação (padrão: `Identif`)

**Base de CEPs:** carregada do banco (`ceps` table, paginada de 1000 em 1000) e mesclada com CSV opcional. Sem CEPs disponíveis o match falha.

---

## Pipeline de match de endereços

Executado 100% client-side. Processa 20 linhas por frame tick (via `setTimeout(0)`) para não travar a UI.

### Etapa 1 — Normalização do texto

`normText()` faz:
- Remove acentos (`NFKD`)
- Uppercase
- Expande abreviações: `AV.` / `AV` → `AVENIDA`, `R` → `RUA`, `PCA` → `PRACA`
- Remove pontuação (`,`, `.`, `;`, `:`, `/`, `\`, `-`)
- Normaliza marcadores de número: `N:10` → `N 10`, `N10` → `N 10`
- Colapsa espaços múltiplos

### Etapa 2 — Parse do endereço (`parseEndereco`)

Extrai três componentes:

| Campo | Como extrai |
|-------|------------|
| `parsed_logradouro` | Tokens a partir do tipo de via (`RUA`, `AVENIDA`, etc.) até o número |
| `parsed_numero` | Primeiro número após marcador (`N`, `NO`, `NR`, `NUM`, `NUMERO`) ou número isolado mais longo |
| `parsed_bairro` | Tokens após o número; busca por anchors (`JARDIM`, `VILA`, `CENTRO`, `COHAB`, etc.) |

Tokens de ruído ignorados no match: `AP`, `APTO`, `BL`, `BLOCO`, `LT`, `LOTE`, `QD`, `QUADRA`, `KM`, `FUNDOS`, etc.

### Etapa 3 — Normalização do bairro (`normalizeBairroRules`)

Aplica aliases hardcoded específicos de Guaíra/Barretos:

| Entrada (variações) | Bairro canônico |
|---------------------|----------------|
| COHAB I, COAB 1 | Doutor Fábio Talarico |
| COHAB II, COAB 2 | Mario Garcia da Costa |
| MUTIRÃO 1 | Conjunto Habitacional Padre Mário Lano |
| MUTIRÃO 3 | Etelvina Santana da Silva |
| CECAP | Conjunto Habitacional Geralda Geltrudes da Silva |
| CAMPOS ELÍSEOS / ELISO / ELISA | Campos Elíseos |
| JARDIM ELIZA / ELIZA | Jardim Eliza |
| JOÃO VACARO / VACCARO | João Vaccaro |
| JOSÉ PUGLIESI / PUGLIESE | Conjunto Habitacional Prefeito José Pugliesi |
| REINALDO / REYNALDO STEIN | Residencial Reynaldo Stein |
| VILLE | Residencial Nobre Ville |
| BOM JESUS | Vila São Bom Jesus Lapa |
| NADIA 4 | Residencial Nadia 4 |
| NADIA | Residencial Nadia |
| SANTA ISABEL | Desmembramento Recreio Santa Isabel |
| SÃO FRANCISCO (exato) | Jardim São Francisco I |
| VIVENDAS | Vivendas do Bom Jardim |
| TONICO GARCIA | Conjunto Residencial Antonio Garcia |
| GUAÍRA E / BAIRRO GUAÍRA E | Conjunto Habitacional Gabriel Garcia de Carvalho |
| PORTAL DO LAGO (A/B) | Portal do Lago [+ complemento A ou B] |
| MURAISHI / MURAISHI II | Residencial Muraishi [I / II] |
| BANESPINHA | Residencial Antonio Nery Lopes |

**Classificações de retorno:**
- `OK` — bairro normalizado com sucesso
- `RUIDO` — tokens ambíguos (ex: "JARDIM" sozinho)
- `COMPLEMENTO` — bairro tem coordenadas (ex: "ENTRE X E Y")
- `REVISAR` — necessita revisão manual

### Etapa 4 — Resolução do bairro no índice de CEPs

Compara `bairro_candidato` (bairro normalizado ou bairro parsed) contra o índice de bairros da base de CEPs:

| Resultado | `bairro_gate` | Condição |
|-----------|--------------|---------|
| Match exato | `EXACT` | Chave normalizada existe no índice |
| Match fuzzy | `FUZZY` | Score >= `bairro_fuzzy_threshold` (padrão 0.405) |
| Sem match | `FAIL` | Score < threshold |

`bairro_anchor_ok = true` somente se `gate ≠ FAIL` **e** `bairro_classificacao = OK`.

### Etapa 5 — Match de logradouro

Só executa se `bairro_anchor_ok = true`. Usa os CEPs do bairro canônico como candidatos.

**Score:** `0.45 × softJaccard + 0.55 × seqRatio`

**Ajuste por rua numerada** (ex: "Rua 3", "Avenida 7B"):
- Mesmo número, sem letra: +0.02
- Mesmo número, mesma letra: +0.03
- Mesmo número, letra diferente: −0.05
- Número diferente: sem ajuste

**Resultado:**
- `match_ok = true` se score >= `min_score_logradouro` (padrão 0.50)
- `AMBIGUO_TOP2_PROXIMO` se top1 − top2 < `ambiguous_gap` (padrão 0.05)

**Fallback global** (toggle na UI, desligado por padrão): se bairro não ancorou, tenta match contra toda a base de CEPs. Sempre retorna `review_status = REVIEW`.

### Etapa 6 — Motivos de revisão

| `review_reason` | Quando ocorre |
|----------------|--------------|
| `BAIRRO_VAZIO` | Bairro não encontrado no endereço |
| `BAIRRO_RUIDO` | Bairro classificado como RUIDO |
| `BAIRRO_COMPLEMENTO` | Bairro tem complemento (coordenadas) |
| `BAIRRO_REVISAR` | Bairro com classificação REVISAR |
| `BAIRRO_NAO_ANCOROU_NA_BASE` | Bairro não encontrou match na base de CEPs |
| `LOGRADOURO_SCORE_BAIXO` | Score de logradouro abaixo do mínimo |
| `AMBIGUO_TOP2_PROXIMO` | Top 1 e Top 2 muito próximos |
| `SEM_CANDIDATOS` | Nenhum CEP candidato no bairro |

---

## Pipeline de match de telefones

### Dados de entrada

JSON de contatos WhatsApp exportado da Evolution API. Pode ser array direto ou `{ contacts: [...] }`.

**Agrupamento** (`readJsonContacts`):
- Agrupa contatos pelo nome normalizado (sem acentos, uppercase)
- Remove sufixos de ano: `" 26"`, `" 2026"` no final do nome
- Prefere `is_my_contact = true` na seleção do contato principal
- Telefone preferido: mais frequente entre duplicatas

### Score de similaridade de nomes (`scoreNamePhone`)

```
score = 0.55 × tokenJaccard + 0.45 × seqRatio
```

**Penalidade:** −0.12 se similaridade do **primeiro token** (primeiro nome) < 0.70. Evita matches onde o primeiro nome difere muito.

### Status do match de telefone

| Status | Condição |
|--------|---------|
| `ATUALIZADO` | Score >= threshold, sem telefone existente (ou overwrite=true), contato único |
| `ATUALIZADO_DUPLICADO` | Igual ao anterior, mas `dup_count > 1` (mesmo nome com múltiplos números) |
| `JA_TINHA_TELEFONE` | Score >= threshold, telefone atual igual ao encontrado |
| `TELEFONE_SECUNDARIO` | Score >= threshold, telefone atual **diferente** do encontrado → salvo como `telefone_secundario` |
| `ABAIXO_THRESHOLD` | Melhor score abaixo do threshold (padrão 0.55) |
| `SEM_NOME` | Pagador sem nome na coluna configurada |
| `SEM_MATCH` | JSON de contatos não carregado |

**Overwrite** (toggle na UI): se ligado, sobrescreve telefone existente com o encontrado no WhatsApp.

---

## Thresholds configuráveis (painel lateral)

| Parâmetro | Padrão | Significado |
|-----------|--------|------------|
| `bairro_fuzzy_threshold` | 0.405 | Score mínimo para FUZZY no bairro |
| `min_score_logradouro` | 0.50 | Score mínimo para `match_ok = true` |
| `token_threshold` | 0.82 | Threshold interno do softJaccard (tokens individuais) |
| `ambiguous_gap` | 0.05 | Diferença mínima entre top1 e top2 para aceitar sem REVIEW |
| `token_weight` / `seq_weight` | 0.45 / 0.55 | Peso Jaccard vs sequência (hardcoded no engine) |
| `phone_threshold` | 0.55 | Score mínimo para aceitar match de nome no WhatsApp |
| `phone_overwrite` | false | Sobrescrever telefone existente |

---

## Campos no CSV de saída

Todos os campos originais do CSV de entrada **mais:**

| Campo | Descrição |
|-------|----------|
| `endereco_usado` | Endereço original |
| `parsed_logradouro` / `parsed_numero` / `parsed_bairro` | Parse extraído |
| `bairro_classificacao` | OK / RUIDO / COMPLEMENTO / REVISAR |
| `bairro_normalizado` | Bairro após aliases |
| `bairro_complemento` | Parte depois de "ENTRE" ou coordenadas |
| `bairro_candidato` | Bairro final usado na busca |
| `bairro_gate` | EXACT / FUZZY / FAIL |
| `bairro_score` | Score do match de bairro |
| `matched_logradouro` / `matched_bairro` / `matched_cep` / `matched_cidade` / `matched_uf` | Endereço canônico da base |
| `matched_numero` | Número extraído (se match_ok) |
| `matched_endereco_completo` | Concatenação do endereço canônico |
| `match_ok` | true/false |
| `review_status` | REVIEW ou vazio |
| `review_reason` | Motivo (ver tabela acima) |
| `top1_score` / `top2_score` / `top1_top2_gap` | Scores diagnósticos |
| `phone_match_score` | Score do nome no WhatsApp |
| `phone_match_name` / `phone_match_phone` | Contato encontrado |
| `phone_match_status` | Status do match de telefone |
| `phone_match_dup_count` / `phone_match_dup_phones` | Duplicatas detectadas |
| `wa_telefone` | Telefone final do WhatsApp (E.164) |
| `wa_encontrado` | SIM / NÃO |
| `telefone_secundario` | Telefone alternativo quando diferente do existente |

---

## Atualização no banco

### Preview de alterações

Antes de gravar, o operador vê um modal listando por pagador (identificado pelo CPF/`Identif`):
- **ATUALIZAR:** campos que mudaram (`street`, `number`, `neighborhood`, `cep`, `city`, `state`, `phone`)
- **NOVO:** pagador que não existe no banco

Apenas linhas com `match_ok = true` atualizam endereço. Telefone é atualizado independente do `match_ok` se o phone match retornou resultado.

### Gravação

- Updates: 50 por vez em `Promise.all`
- Inserts: 50 por vez; fallback individual se batch falha
- Tabela: `payers`
- Campos atualizados: `street`, `number`, `neighborhood`, `cep`, `city`, `state`, `phone`, `match_ok`, `address_base`, `address_original`, `updated_at`

### Salvar contatos WhatsApp no banco

Botão separado: grava os contatos brutos na tabela `whatsapp_contacts`:
- Batch de 200
- Upsert por (`provider_id`, `wa_number`)
- `provider_id` e `instance_name` **hardcoded** no código

---

## Abas de resultado

| Aba | Conteúdo |
|-----|---------|
| Resultados | Tabela de até 200 linhas com scores e endereços canônicos |
| Telefones | Tabela de até 300 linhas com scores e status do match de telefone |
| Bairros | Top 30 bairros candidatos com contagem e gate (diagnóstico) |
| Falhas | Até 50 primeiras linhas sem `match_ok` com motivo |

---

## Melhorias possíveis

- [x] `provider_id` e `instance_name` de `importContactsToDb` eram hardcoded — corrigido em 2026-03-20, agora busca provider ativo em `whatsapp_providers WHERE active = true`
- [x] Aliases de bairro hardcoded em `_mapBairroAlias` — corrigido em 2026-03-20; movidos para tabela `bairro_aliases` no banco (ver abaixo)
- [ ] Tabela de resultados mostra só 200 linhas — sem paginação (usuário precisa exportar para ver tudo)
- [ ] Sem `import_log` registrado para o match de endereços — impossível auditar quais pagadores foram atualizados por qual execução
- [ ] Match de telefone e endereço independentes mas sem feedback claro de qual conflitou ao atualizar o banco

---

## Tabela `bairro_aliases`

Aliases de bairro gerenciáveis pelo operador diretamente na UI (`/match-enderecos` → card "Aliases de Bairro").

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `entrada` | text | Padrão a buscar no bairro normalizado (UPPERCASE, sem acentos) |
| `bairro_canonico` | text | Nome oficial do bairro na base de CEPs |
| `complemento` | text? | Sufixo opcional (ex: "A", "B", "II") |
| `match_type` | EXACT \| CONTAINS | CONTAINS = substring; EXACT = igualdade |
| `ativo` | boolean | Soft-delete |
| `ordem` | integer | Prioridade (menor = primeiro); dentro do mesmo ordem, padrões mais longos têm precedência |

**Lógica de matching em `applyBairroAliases`:**
1. Aliases ordenados: `ordem` ascendente, depois `entrada.length` descendente (mais específico primeiro)
2. Para cada alias: testa EXACT ou CONTAINS contra o texto normalizado
3. Primeiro match retorna `[bairro_canonico, complemento]`
4. Se nenhum alias do banco bater → fallback para regras hardcoded em `_mapBairroAlias`

Seed inicial: 27 aliases hardcoded migrados para o banco em `20260320120000_create_bairro_aliases.sql`.
