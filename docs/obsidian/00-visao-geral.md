# Visão Geral do Sistema

## O que é o sistema

**Tavares Finance** (repo: `route-finance-hub`) é um sistema de gestão integrado desenvolvido para a **Tavares Transportes**, empresa que opera transporte escolar e excursões. O sistema centraliza gestão financeira, controle de pagadores, emissão e distribuição de boletos, presença de alunos, frota, manutenção, excursões públicas com checkout online e comunicação via WhatsApp.

É uma SPA (Single Page Application) com backend serverless via Supabase, acessível por navegador e instalável como PWA.

---

## Problema que resolve

Antes do sistema, a operação dependia de planilhas desconectadas, comunicação manual de cobranças e sem rastreabilidade de acesso a boletos. Os problemas centrais eram:

- Sem visibilidade de quais alunos baixaram ou não o boleto do mês
- Controle financeiro (DRE) fora do sistema de cobrança
- Importação manual e propensa a erro de dados de pagadores e boletos
- Ausência de canal estruturado para vendas de excursões ao público
- Registro de presença dependente de processo físico (papel)
- Comunicação WhatsApp sem histórico ou automação

---

## Módulos principais

| Módulo | Propósito |
|--------|-----------|
| **Financeiro** | DRE, receitas, despesas, cartões, conciliação bancária |
| **Pagadores** | Cadastro de alunos/responsáveis, status, revisão, exportação |
| **Boletos / 2ª Via** | Links públicos de boletos, portal de consulta, logs de acesso |
| **Excursões** | Cadastro, venda pública com checkout + PIX, gestão de assentos |
| **Afiliados** | Parceiros de venda de excursões com comissão configurável |
| **Presença** | Check-in de alunos por QR code com geolocalização |
| **Transporte** | Rotas, veículos, ônibus, viagens automáticas |
| **Manutenção** | Chamados de manutenção, inspeção de frota, motoristas |
| **WhatsApp** | Campanhas em massa, grupos por rota, enquetes (polls) |
| **Importação** | Carga em lote de CSV/Excel (pagadores, boletos, faturas) |
| **Admin / Auditoria** | Painel admin, audit_logs, diagnóstico de sistema |
| **Landing Page** | Site público configurável da empresa |

---

## Stack principal

| Camada | Tecnologia |
|--------|------------|
| Framework | React 18.3.1 + TypeScript 5.8.3 |
| Build | Vite 5.4.19 + vite-plugin-pwa |
| State/Data | TanStack React Query 5.83.0 |
| Roteamento | React Router DOM 6.30.1 |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 3.4.17 |
| Animações | Framer Motion 12.33.0 |
| Formulários | React Hook Form 7.61.1 + Zod 3.25.76 |
| Backend/Auth/DB | Supabase JS 2.95.3 (PostgreSQL + Auth + Edge Functions) |
| Gráficos | Recharts 2.15.4 |
| Exportação | xlsx 0.18.5 + papaparse 5.5.3 |
| Datas | date-fns 3.6.0 |
| Precisão numérica | decimal.js 10.6.0 |
| Notificações | Sonner 1.7.4 |
| Ícones | Lucide React 0.462.0 |
| QR Code | html5-qrcode + qrcode.react |

---

## Público-alvo

**Usuários administrativos (protegidos por login Supabase Auth):**
- Gestor da empresa (acesso ao financeiro, DRE, dashboard executivo)
- Operador (importação de dados, gestão de pagadores e boletos)
- Motoristas/operação (manutenção, inspeção, rotas)

**Usuários públicos (sem login de conta administrativa):**
- Alunos/responsáveis: portal de 2ª via de boletos, presença (login por CPF via Edge Function)
- Público geral: catálogo de excursões, checkout online, portal de afiliados

---

## Links relacionados

- [[01-arquitetura]] — Como o sistema está estruturado tecnicamente
- [[05-telas-e-fluxos]] — Todas as 48 páginas e fluxos de navegação
- [[04-regras-de-negocio]] — Regras por módulo
