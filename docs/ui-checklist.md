# UI Checklist

## Tela: `/public/excursoes`

- [x] Checkout em duas colunas no desktop (conteúdo de checkout à esquerda e resumo da viagem à direita).
- [x] Card de resumo da viagem fixo no desktop (`sticky`) durante o preenchimento.
- [ ] Ajustar largura da coluna direita conforme conteúdo real (ex.: `320px`, `360px`, `400px`).
- [ ] Padronizar status comercial no resumo (`Disponível`, `Últimas vagas`, `Encerrada`) sem mostrar quantidade exata de assentos.
- [ ] Melhorar stepper com contraste e estados mais claros (`ativo`, `concluído`, `pendente`).
- [ ] Adicionar validação inline por campo (além de toast), com foco automático no primeiro erro.
- [ ] Melhorar CTA principal com texto de apoio para reduzir abandono ("você poderá revisar antes de pagar").
- [ ] Implementar resumo de pedido dinâmico no card da direita (assentos selecionados, total e modalidade).
- [ ] Revisar responsividade mobile para garantir leitura e ação rápida em 1 coluna.
- [ ] Corrigir totalmente encoding/textos com caracteres quebrados nesta tela.
