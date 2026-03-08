# Melhorias Futuras

## 1) Fila de Revisão Operacional
- [ ] Centralizar todos os registros com `needs_review` em uma inbox única (`pagadores`, `saídas`, `rotas`).
- [ ] Exibir prioridade por impacto financeiro e tempo em revisão.
- [ ] Adicionar ações rápidas: `Classificar`, `Vincular`, `Corrigir`, `Ignorar com justificativa`.

## 2) Regras Automáticas de Qualidade
- [ ] Criar validações de pré-salvamento com `soft block` (salvar com pendência explícita).
- [ ] Destacar inconsistências por tipo (ex.: `CUSTO` sem veículo).
- [ ] Exibir score de qualidade por lançamento/importação.

## 3) Versionamento de Importação
- [ ] Gerar `run_id` para toda importação.
- [ ] Salvar diff de inserções/atualizações por lote.
- [ ] Implementar rollback por `run_id` com confirmação.

## 4) Motor de Classificação DRE
- [ ] Implementar sugestão automática de grupo/subgrupo por histórico e palavras-chave.
- [ ] Mostrar confiança da sugestão (alta/média/baixa).
- [ ] Aprender com correções manuais (feedback loop).

## 5) Conciliação Financeira
- [ ] Criar tela de conciliação por extrato/PIX/cartão.
- [ ] Marcar lançamentos conciliados vs pendentes.
- [ ] Identificar e tratar lançamentos órfãos.

## 6) Governança e Auditoria
- [ ] Garantir trilha completa por entidade (antes/depois, usuário, origem).
- [ ] Padronizar `source` em operações (`MANUAL`, `IMPORT`, `BOT`).
- [ ] Criar filtros por tabela, usuário e período na auditoria.

## 7) KPIs Operacionais
- [ ] Implementar custo por veículo.
- [ ] Implementar custo por rota.
- [ ] Implementar custo por aluno.
- [ ] Medir inadimplência mensal e aging de boletos.

## 8) Comercial de Excursões
- [ ] Medir funil público (visita -> lead -> PIX gerado -> pago).
- [ ] Exibir conversão por afiliado/campanha.
- [ ] Criar painel de performance comercial por excursão.

## 9) Cancelamento e Reembolso
- [ ] Criar fluxo padrão de cancelamento no checkout público.
- [ ] Definir SLA e regras de reembolso por tipo de operação.
- [ ] Registrar protocolo e histórico completo de estorno.

## 10) Performance e Escala
- [ ] Implementar paginação server-side nas tabelas grandes.
- [ ] Revisar índices para filtros mais usados.
- [ ] Reduzir payloads e otimizar queries críticas.

## Roadmap sugerido (prioridade)
- [ ] Curto prazo: itens 1, 2, 4.
- [ ] Médio prazo: itens 3, 5, 7.
- [ ] Longo prazo: itens 8, 9, 10.


## 11) Sincronização de Contatos WhatsApp (Evolution + Supabase)
- [ ] Criar fluxo completo para sincronizar contatos da instância conectada na Evolution API.
- [ ] Buscar lista completa de contatos via endpoint da Evolution.
- [ ] Criar tabela cache no Supabase com campos mínimos: `provider_id`, `instance_name`, `wa_number`, `wa_jid`, `display_name`, `raw (json)`, `updated_at`, `created_at`.
- [ ] Criar chave única por `provider_id + instance_name + wa_number`.
- [ ] Implementar action/endpoint (Edge Function) para o botão `Atualizar lista de contatos`.
- [ ] Na action: consultar provider (`base_url`, `api_key`, `instance_name`), buscar contatos, normalizar e fazer upsert.
- [ ] Regra obrigatória: se já existir o mesmo `wa_number`, atualizar `display_name` e `raw` quando houver mudança.
- [ ] Garantir que não haja duplicidade para o mesmo número.
- [ ] Listar contatos no frontend consumindo a tabela do Supabase (nome + número).
- [ ] Recarregar a listagem automaticamente após clicar em `Atualizar lista de contatos`.
- [ ] Entrega técnica esperada: SQL da tabela/índices, código da função de sincronização, frontend com botão/listagem, erros/logs básicos, pronto para Supabase (sem pseudo-código).
