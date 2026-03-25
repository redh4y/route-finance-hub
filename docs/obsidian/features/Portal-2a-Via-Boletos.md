# Feature: Portal de 2ª Via de Boletos

**Página:** `/logs/2via-boletos`
**Arquivo:** `src/pages/BoletoAccessLogs.tsx`
**Status:** Em produção, evoluindo

---

## Objetivo

Página interna de gestão que permite à equipe Tavares:
1. Auditar logs de acesso ao portal público de boletos
2. Ver cobertura do mês — quantos alunos acessaram e baixaram
3. Identificar e contatar pendências — alunos que ainda não baixaram o boleto

---

## Seções da página

### Logs de acesso
Tabela paginada com todas as ações (`SEARCH` / `DOWNLOAD`) registradas no portal público.
Filtros: busca por CPF/nome, filtro por tipo de ação, paginação.

### Cobertura do mês
Card com 6 métricas para o `reference_month` selecionado:
- Total com boleto
- Já consultaram
- Já baixaram
- Consultou e não baixou
- Ainda não baixaram
- Nem consultaram

### Pendências de download
Tabela de alunos que **não pagaram** o boleto do mês selecionado, filtrada a pagadores com `status = 'ATIVO'` no banco.

Colunas: Nome · CPF · Status (Consultou / Não acessou) · Último acesso · Contato

**Filtros da tabela de pendências:**
- **Busca por nome ou CPF** — filtra em tempo real
- **Filtro de status** — Não pago *(padrão)* / Consultou / Não acessou
- Badges no cabeçalho: total de pendências, quantidade filtrada (quando diferente), quantidade sem número de WhatsApp

**Botões de contato por linha (icon-only com tooltip):**
- `Info` — **Aviso de emissão** — instrui a acessar o portal e baixar o boleto
- `Link` — **Enviar link do boleto** — mensagem curta com link direto (só aparece se houver `boleto_url`)
- `Clock` — **Avisar vencimento** — lembrete de prazo com dias calculados a partir da data atual; inclui link do boleto se disponível

**Botões em lote (todos os pendentes, não afetados pelos filtros):**
- **Aviso de emissão (todos)**
- **Enviar link do boleto (todos)**
- **Aviso de vencimento (faltam Xd)** — título calculado dinamicamente; "atrasado Xd" quando já venceu

**Exportar CSV** — exporta a lista **filtrada** atual com: Nome, CPF, Telefone, Status, Último acesso, Vencimento. BOM UTF-8 incluído para compatibilidade com Excel.

---

## Regras de negócio

- Pendências = pagadores `ATIVO` **sem** `billing.status = 'PAID'` no mês selecionado (cross-reference via `billings.payer_id`)
- Pagadores `INATIVO` são excluídos da lista e não recebem mensagens
- `view_url` é preferido sobre `drive_url` para o link do boleto
- Datas de vencimento do tipo `YYYY-MM-DD` são parseadas com fuso local (local noon) para evitar rollback de dia em UTC-3
- Destacar linha ao clicar em qualquer botão de contato (cor `bg-emerald-200` + borda esquerda verde)
- Filtros de busca e status afetam apenas a exibição e o CSV — os botões de lote sempre operam sobre **todos** os pendentes ativos
- Todas as mensagens: sem emojis, com rodapé `_Caso já tenha efetuado o pagamento, desconsidere esta mensagem._`

---

## Melhorias possíveis

- [ ] Marcar manualmente como "pago por fora" (requer coluna nova no banco)
- [ ] Registrar no banco quem foi contatado via WhatsApp (data + tipo de mensagem)
- [ ] Gráfico comparativo de cobertura entre meses
