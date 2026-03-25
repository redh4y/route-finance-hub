# Glossário do Domínio

Termos específicos do negócio e do sistema Tavares Finance.

---

## Boleto / 2ª via

**2ª via de boletos**
Portal público onde pagadores acessam e baixam o boleto do mês vigente.
URL: `https://tavarestransportes.com/2-via-boletos`
Identificação: feita por CPF (dígitos finais).

**reference_month**
Identificador do mês de cobrança no formato `YYYY-MM` (ex: `2026-03`).
Chave de associação entre boletos, logs de acesso e cobertura.

**payer_boleto_links**
Tabela Supabase. Cada linha = um boleto de um aluno em um mês.
Campos relevantes: `cpf_digits`, `student_name`, `reference_month`, `due_date`, `view_url`, `drive_url`.
Não possui campo de status de pagamento — pagamento não é rastreado pelo sistema.

**view_url / drive_url**
Links do boleto. `view_url` é preferido (link de visualização). `drive_url` é o fallback (link do Google Drive).

---

## Logs de acesso

**public_boleto_access_logs**
Tabela que registra cada interação no portal público.
Ações possíveis: `SEARCH` (consultou CPF) e `DOWNLOAD` (baixou o boleto).

**SEARCH**
O aluno acessou o portal e buscou pelo CPF. Pode ter encontrado ou não o boleto.

**DOWNLOAD**
O aluno clicou para baixar o boleto. Marca a pessoa como "já baixou".

---

## Cobertura do mês

**Cobertura do mês**
Relatório que cruza `payer_boleto_links` com `public_boleto_access_logs` para um `reference_month`.
Mostra quantos alunos consultaram e quantos baixaram o boleto.

**Pendência de download**
Lista de alunos de `payer_boleto_links` que ainda NÃO fizeram DOWNLOAD no mês vigente.
Critério: `downloaded = false` (nenhum log com `action = 'DOWNLOAD'` para aquele CPF no mês).
**Não inclui** quem já baixou — independente de ter pago ou não.

| Status | Significado |
|---|---|
| Não acessou | Nenhum log no mês (nem SEARCH) |
| Consultou | Tem SEARCH mas não tem DOWNLOAD |
| Já baixou | Tem DOWNLOAD — fora da lista de pendências |

---

## Pagadores

**payers**
Tabela com dados cadastrais dos pagadores: `document_digits` (CPF), `phone`, `last_payment_at`, etc.
`document_digits` é a chave de cruzamento com `payer_boleto_links.cpf_digits`.

**cpf_digits**
Dígitos finais do CPF usados como identificador público no portal.
Não é o CPF completo — é apenas um fragmento para identificação simplificada.
