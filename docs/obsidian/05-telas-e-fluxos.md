# Telas e Fluxos de Navegação

## Tabela completa das 48 páginas

### Módulo Admin / Gestão (protegidas por ProtectedRoute)

| Rota | Arquivo | Módulo | Descrição |
|------|---------|--------|-----------|
| `/dashboard` | `Dashboard.tsx` | Gestão | Dashboard executivo com KPIs, gráficos e resumo operacional |
| `/pagadores` | `Payers.tsx` (967 lin) | Pagadores | CRUD completo de pagadores, filtros, busca, exportação |
| `/importar` | `Import.tsx` (2050 lin) | Importação | Upload CSV/Excel com validação, preview e confirmação em batch |
| `/boletos-links` | `BoletoLinks.tsx` | Boletos | Gerenciamento de links de boletos por pagador e mês |
| `/logs/2via-boletos` | `BoletoAccessLogs.tsx` (1172 lin) | Boletos | Logs de acesso, cobertura mensal, pendências, contato WhatsApp |
| `/financeiro` | `Financial.tsx` | Financeiro | DRE (Demonstração de Resultado do Exercício) |
| `/financeiro/entradas` | `FinancialRevenue.tsx` | Financeiro | Gestão de receitas |
| `/financeiro/saidas` | `FinancialExpenses.tsx` (1911 lin) | Financeiro | Gestão de despesas com cartões e parcelamentos |
| `/rotas` | `Routes.tsx` | Transporte | Cadastro e gestão de rotas de transporte escolar |
| `/atrasos` | `Overdue.tsx` | Financeiro | Monitoramento de cobranças em atraso |
| `/veiculos` | `Vehicles.tsx` | Frota | Cadastro e gestão da frota de veículos |
| `/cartoes` | `Cards.tsx` | Financeiro | Gerenciamento de cartões de crédito corporativos |
| `/excursoes` | `Excursions.tsx` | Excursões | Listagem e gestão de excursões cadastradas |
| `/excursoes/nova` | `ExcursionForm.tsx` | Excursões | Criação e edição de excursão |
| `/excursoes/:id` | `ExcursionDetail.tsx` | Excursões | Detalhe com passageiros, assentos e vendas |
| `/match-enderecos` | `AddressMatch.tsx` (1623 lin) | Utilitários | Engine de matching de endereços contra tabela CEP |
| `/conciliacao` | `Reconciliation.tsx` | Financeiro | Conciliação bancária de lançamentos |
| `/afiliados` | `Affiliates.tsx` | Afiliados | Gestão de parceiros e comissões |
| `/leads` | `Leads.tsx` | Comercial | Gestão de leads de vendas de excursões |
| `/relatorios` | `Reports.tsx` | Comercial | Relatórios e funil de vendas |
| `/manutencao` | `Maintenance.tsx` | Manutenção | Gestão de chamados de manutenção de frota |
| `/manutencao/motoristas` | `Drivers.tsx` | Manutenção | Cadastro de motoristas |
| `/manutencao/inspecao` | `InspectionChecklists.tsx` | Manutenção | Checklists de inspeção de veículos |
| `/whatsapp` | `Whatsapp.tsx` | Comunicação | Integração WhatsApp: campanhas, grupos, enquetes |
| `/enquetes` | `PollDashboard.tsx` | Comunicação | Gestão de enquetes e resultados |
| `/revisao` | `ReviewInbox.tsx` | Qualidade | Inbox de revisão de dados com pendências |
| `/admin` | `AdminPanel.tsx` | Admin | Painel administrativo do sistema |
| `/configuracoes` | `Settings.tsx` | Admin | Configurações gerais da aplicação |
| `/configuracoes/publico` | `PublicSiteSettings.tsx` | Admin | Configurações do site público |
| `/landing-settings` | `LandingSettings.tsx` | Admin | Configurações da landing page pública |
| `/diagnostico` | `Diagnostics.tsx` | Admin | Ferramenta de diagnóstico, logs e erros capturados |
| `/auditoria` | `Audit.tsx` | Admin | Auditoria e histórico de ações (audit_logs) |

### Módulo de Presença (mix público e admin)

| Rota | Arquivo | Tipo | Descrição |
|------|---------|------|-----------|
| `/presenca/login` | `StudentLogin.tsx` | Público | Login de aluno por CPF (via Edge Function student-auth) |
| `/presenca` | `StudentDashboard.tsx` | Aluno | Dashboard do aluno com próximas viagens |
| `/presenca/checkin` | `StudentCheckIn.tsx` | Aluno | Check-in via câmera QR code + geolocalização |
| `/presenca/historico` | `StudentHistory.tsx` | Aluno | Histórico de presenças do aluno |
| `/presenca/perfil` | `StudentProfile.tsx` | Aluno | Perfil e dados do aluno |
| `/presenca/ajuda` | `StudentHelp.tsx` | Aluno | Página de ajuda para alunos |
| `/presenca/admin` | `AttendanceAdmin.tsx` | Protegida | Administração de presenças (visão admin) |

### Páginas Públicas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/auth` | `Auth.tsx` | Login e cadastro de usuários admin |
| `/reset-password` | `ResetPassword.tsx` | Recuperação de senha via email |
| `/site` | `LandingPage.tsx` | Landing page pública da empresa |
| `/2-via-boletos` | `PublicBoletoLinksPage.tsx` (782 lin) | Portal público de 2ª via de boletos |
| `/public/excursoes` | `PublicExcursions.tsx` | Catálogo público de excursões disponíveis |
| `/public/excursoes/:token` | `PublicExcursion.tsx` | Detalhe de excursão + checkout (seleção de assentos + PIX) |
| `/afiliado/:token` | `AffiliatePortal.tsx` | Portal do afiliado com links e comissões |
| `/oauth/callback` | `OAuthCallback.tsx` | Callback OAuth (Google Drive) |
| `*` | `NotFound.tsx` | Página 404 |

---

## Navegação principal (Sidebar)

A `Sidebar.tsx` agrupa os itens de navegação admin em grupos:

| Grupo | Itens |
|-------|-------|
| Principal | Dashboard |
| Financeiro | Financeiro (DRE), Entradas, Saídas, Conciliação, Atrasos, Cartões |
| Operacional | Pagadores, Boletos-Links, Logs 2ª via, Importar, Revisão |
| Transporte | Rotas, Veículos, Presença Admin |
| Frota | Manutenção, Motoristas, Inspeção |
| Comercial | Excursões, Leads, Relatórios, Afiliados |
| Comunicação | WhatsApp, Enquetes |
| Sistema | Admin, Configurações, Landing Settings, Diagnóstico, Auditoria, Match Endereços |

A sidebar tem 15+ itens com grupos colapsáveis. Em mobile, é acessada via Sheet drawer com header fixo (56px). Em desktop, é fixa com largura 64px (ícones) ou expandida.

---

## Portais públicos

| Portal | URL | Propósito |
|--------|-----|-----------|
| Landing Page | `/site` | Apresentação da empresa, captação de leads de excursões |
| 2ª via de boletos | `/2-via-boletos` | Alunos/responsáveis consultam e baixam boleto do mês por CPF |
| Catálogo de excursões | `/public/excursoes` | Listagem de excursões com public_enabled = true |
| Checkout de excursão | `/public/excursoes/:token` | Seleção de assentos + checkout PIX para o público geral |
| Portal de afiliado | `/afiliado/:token` | Afiliado vê seus links, vendas e comissões pendentes |
| Login de aluno | `/presenca/login` | Entrada do módulo de presença para alunos (autenticação por CPF) |

---

## Links relacionados

- [[06-componentes]] — Componentes usados nas páginas
- [[04-regras-de-negocio]] — Regras aplicadas em cada módulo
