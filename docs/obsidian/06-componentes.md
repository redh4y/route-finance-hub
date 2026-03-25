# Componentes

## Tabela por categoria

### ui/ — Design System (shadcn/ui)

Componentes primitivos baseados em Radix UI, estilizados com Tailwind CSS. Não devem conter lógica de negócio.

Exemplos: `Button`, `Dialog`, `Table`, `Sheet`, `Tabs`, `Badge`, `Card`, `Input`, `Select`, `Checkbox`, `Toast`, `Tooltip`, `Popover`, `Command`, `Skeleton`, `Separator`, `ScrollArea`, `DropdownMenu`, `AlertDialog`, `Calendar`, `Switch`.

### layout/

| Componente | Linhas | Responsabilidade |
|------------|--------|-----------------|
| `MainLayout.tsx` | 306 | Wrapper principal: sidebar fixa (desktop) ou Sheet drawer (mobile), header fixo 56px em mobile |
| `Sidebar.tsx` | — | Navegação com 15+ itens agrupados, logout, exibe email do usuário logado |

### dashboard/

Componentes de KPIs, gráficos (Recharts) e cards de resumo para o Dashboard executivo (`/dashboard`).

### boletos/

| Componente | Descrição |
|------------|-----------|
| `DriveProcessorTab.tsx` | 710 linhas — interface de processamento OCR de PDFs via Google Drive; autenticação OAuth, upload, extração de dados de boletos |
| Componentes de listagem de links | Cards e tabelas de `payer_boleto_links` |
| Componentes de logs | Filtros, tabela de pendências, cobertura mensal em `BoletoAccessLogs` |

### payers/

| Componente | Descrição |
|------------|-----------|
| `PayerDetailsModal.tsx` | 567 linhas — modal com todos os dados do pagador: histórico de faturas, contatos extras, change_log, ações (ativar/inativar, editar) |
| Componentes de filtro | Busca por nome, CPF, status, billing_mode |
| Componentes de exportação | Botões que chamam `export-utils.ts` |

### excursions/

| Componente | Descrição |
|------------|-----------|
| Seat map | Mapa visual de assentos com status DISPONIVEL/VENDIDO/BLOQUEADO |
| Formulário de excursão | Campos de destino, datas, veículo, capacidade, preço, token público |
| Card de passageiro | Exibição de dados do passageiro + status do pedido |
| Checkout público | Seleção de assentos + formulário de dados + QR PIX (em `components/checkout/`) |

### financial/

| Componente | Descrição |
|------------|-----------|
| DRE view | Tabela hierárquica grupos → subgrupos → lançamentos com totalizadores |
| Formulário de lançamento | Campos tipo, categoria, subcategoria, valor, data, status com sugestão de IA |
| Filtros de período | Seletor de mês/ano para DRE e listas de receitas/despesas |
| Card de cartão | Resumo de fatura por cartão de crédito |

### attendance/

| Componente | Descrição |
|------------|-----------|
| QR scanner | Câmera + `html5-qrcode` para leitura do QR do ônibus |
| Mapa de presença | Exibição de registros de check-in do dia para admin |
| Dashboard do aluno | Próximas viagens, status de presença, link para check-in |
| Histórico | Lista paginada de presenças com data, ônibus, status |

### landing/

Seções configuráveis da landing page pública (`/site`): hero, serviços, depoimentos, contato. Conteúdo gerenciado via `landing_settings` no banco.

### checkout/

Fluxo de compra público para excursões: seleção de assentos, formulário de dados do passageiro, exibição de PIX QR code, confirmação de reserva.

### admin/

Componentes do painel administrativo (`/admin`): estatísticas do sistema, gerenciamento de usuários, configurações avançadas.

---

## Componentes críticos detalhados

### MainLayout.tsx (306 linhas)

Wrapper de layout para todas as páginas admin. Comportamento responsivo:
- **Desktop:** sidebar fixa à esquerda (64px de largura), conteúdo ocupa o restante da tela
- **Mobile:** header fixo com 56px de altura + botão hamburguer que abre `Sheet` com sidebar completa
- Recebe `children` e renderiza dentro da área de conteúdo principal
- Todas as páginas admin usam este layout via padrão de composição

### Sidebar.tsx

- 15+ itens de navegação agrupados em seções colapsáveis
- Exibe email do usuário logado (via `useAuth()`)
- Botão de logout chama `AuthContext.signOut()`
- Itens com ícones Lucide React
- Estado de grupo expandido/colapsado persiste durante a sessão

### DriveProcessorTab.tsx (710 linhas)

Componente de alto custo que integra com Google Drive para OCR de boletos:
- Gerencia fluxo OAuth do Google (client-side, via `useDriveProcessor`)
- Permite upload de pasta no Drive ou seleção de arquivos
- Chama Edge Function `boleto-drive-processor` para cada PDF
- Exibe resultado da extração: payer_name, cpf, digitable_line, amount, due_date
- Permite confirmar e salvar os dados extraídos em `payer_boleto_links`
- **Débito técnico:** 710 linhas — candidato a refatoração (ver [[10-debitos-tecnicos]])

### PayerDetailsModal.tsx (567 linhas)

Modal completo de detalhe de pagador:
- Dados cadastrais com edição inline
- Histórico de `billings` (faturas) com status de pagamento
- Lista de `change_log` (JSON) com histórico de alterações
- `extra_contacts` editáveis
- Ações: ativar/inativar, marcar para revisão, gerar link de boleto
- **Débito técnico:** 567 linhas — candidato a decomposição em sub-componentes

---

## Padrão de composição de página

Todas as páginas admin seguem este padrão:

```tsx
// src/pages/NomePagina.tsx
export default function NomePagina() {
  return (
    <MainLayout>
      <PageTransition>
        {/* conteúdo da página */}
      </PageTransition>
    </MainLayout>
  )
}
```

`PageTransition` usa Framer Motion para animar a entrada da página (fade/slide). O componente está em `src/components/layout/` ou similar.

---

## Design system

| Tecnologia | Papel |
|------------|-------|
| **shadcn/ui** | Componentes de UI acessíveis baseados em Radix UI (sem estilo próprio, usa Tailwind) |
| **Tailwind CSS 3.4.17** | Estilização utility-first; configuração em `tailwind.config.ts` |
| **Framer Motion 12.33.0** | Animações de entrada de página e componentes interativos |
| **Lucide React 0.462.0** | Biblioteca de ícones SVG (tree-shakeable) |
| **Sonner 1.7.4** | Notificações toast (substituição do shadcn/ui toast nativo) |

Paleta de cores e tokens de design configurados no `tailwind.config.ts` com variáveis CSS para suporte a dark/light mode.

---

## Links relacionados

- [[02-estrutura-de-pastas]] — Onde os componentes estão no projeto
- [[08-estados-e-hooks]] — Hooks consumidos pelos componentes
