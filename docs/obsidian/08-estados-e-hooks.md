# Estado e Hooks

## Contextos

### AuthContext.tsx

Gerencia autenticação via Supabase Auth. É o provedor raiz da aplicação (acima do Router).

```ts
interface AuthContextType {
  user: User | null        // objeto User do Supabase Auth (null = não autenticado)
  session: Session | null  // JWT session (null = não autenticado)
  isLoading: boolean       // true durante verificação inicial da sessão
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}
```

- **Listener:** `supabase.auth.onAuthStateChange()` — reage a SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
- **Persistência:** Session em localStorage, `autoRefreshToken: true` (renovação automática do JWT)
- **Hook de consumo:** `useAuth()` — usado em ProtectedRoute, Sidebar, e qualquer componente que precise do usuário
- **ProtectedRoute:** verifica `user !== null`; se `isLoading` mostra spinner; se `user === null` redireciona para `/auth`

### DiagnosticsContext.tsx

Intercepta e persiste logs de erros e warnings do sistema para diagnóstico operacional.

- **O que intercepta:** `console.error`, `console.warn`, `console.info`, erros globais `window.onerror`, `unhandledrejection`, falhas de `fetch`
- **Persistência:** localStorage com chave `tavares_diagnostics_entries_v1`, máximo de 400 entradas (FIFO)
- **Segurança:** redact automático de Bearer tokens e API keys nos logs antes de persistir
- **Hook de consumo:** `useDiagnostics()` — usado na página `/diagnostico`

---

## Tabela completa de hooks (23 hooks)

| Hook | Propósito | Queries principais | Mutations | Cache Key |
|------|-----------|-------------------|-----------|-----------|
| `usePayers` | CRUD completo de pagadores com filtros | payers list, payers stats, payer single | create, update, delete, toggleStatus | `["payers", filters]`, `["payers-stats"]`, `["payer", id]` |
| `useDashboardStats` | KPIs do dashboard (contagens de payers e billings) | payers, billings | — | `["dashboard-stats", currentMonth]` |
| `useEnhancedDashboard` | Dashboard avançado com range de datas | financial_entries com filtro de período | — | `["enhanced-dashboard", dateRange]` |
| `useExcursions` | Gestão completa de excursões | excursions, seats, ticket_sales, excursion single | create, update, delete, sellTicket | `["excursions"]`, `["excursion", id]`, `["excursion-seats", id]`, `["ticket-sales", id]` |
| `useAffiliates` | Afiliados, vínculos e comissões | affiliates, affiliate_excursions, commissions, public_orders | create, update, delete | `["affiliates"]`, `["excursion-affiliates", id]`, `["affiliate-commissions", id]` |
| `useAttendance` | Presença com polling ativo | trips (RPC, refetch 30s), attendance (refetch 15s) | checkIn mutation | `["today-trips"]`, `["student-attendance-today"]` |
| `usePolls` | Enquetes e templates | poll_templates, whatsapp_groups | create, dispatch | `["poll-templates"]`, `["whatsapp-groups"]` |
| `useOptimizedImport` | Importação em batches de 100 items | — | upsert payers, upsert boleto_links, upsert CEPs | Invalida: `["payers"]`, `["billings"]` |
| `useImport` | Importação (versão anterior) | — | upsert payers, billings | — |
| `useInvoiceImport` | Importação de notas fiscais/faturas | — | upsert installment_contracts, upsert financial_entries (sem downgrade REAL→PREVISTO) | Invalida: `["financial-entries"]`, `["dre"]`, `["import-logs"]` |
| `useDriveProcessor` | Google Drive OAuth + token management | — | OAuth flow, token store | localStorage (token Drive) |
| `useMaintenanceTickets` | CRUD de chamados de manutenção com filtros | maintenance_tickets | create, update, delete | — |
| `useInspectionChecklists` | CRUD de checklists de inspeção | inspection_checklists | create, update | — |
| `useDrivers` | CRUD de motoristas | drivers | create, update, delete | — |
| `useLandingSettings` | Configurações da landing page | landing_settings | update sections | — |
| `usePublicSiteContent` | Conteúdo público da landing | landing_settings (enabled sections) | — | — |
| `usePublicExcursion` | Dados públicos de excursão por token | excursions (por public_token), excursion_seats | — | — |
| `useAdminStats` | Estatísticas gerais para painel admin | Múltiplas tabelas | — | — |
| `useAffiliatePortal` | Dados do portal de afiliado por token | affiliate_excursions, commissions | — | — |
| `useGeolocation` | GPS/localização do browser | — (Web API) | — | — |
| `useClassifyEntry` | Classifica lançamento via Edge Function | — | invoke "classify-entry" Edge Function | — |
| `use-toast` | Notificações toast via Sonner | — | showToast, dismiss | — |
| `use-mobile` | Detecta viewport mobile | — (window resize) | — | — |

---

## Padrões de React Query utilizados

### useQuery (leitura de dados)

```ts
const { data, isLoading, error } = useQuery({
  queryKey: ["payers", filters],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("payers")
      .select("id, name, status")
      .eq("status", filters.status)
    if (error) throw error
    return data
  },
})
```

### useMutation (escrita de dados)

```ts
const createPayer = useMutation({
  mutationFn: async (payload) => {
    const { data, error } = await supabase.from("payers").insert(payload)
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["payers"] })
    toast.success("Pagador criado")
  },
  onError: (error) => {
    toast.error(`Erro: ${error.message}`)
  },
})
```

### invalidateQueries (invalidação de cache)

Chamado no `onSuccess` das mutations para forçar refetch dos dados afetados. Segue o padrão de invalidar pela chave raiz (`["payers"]`) para afetar todas as queries que começam com essa chave.

### Polling ativo (refetchInterval)

Usado em módulos que precisam de atualização em tempo real sem WebSocket:
- `useAttendance`: trips refetch a cada 30s, attendance a cada 15s
- Trips do dia podem ser criadas automaticamente pela função SQL `ensure_today_trips()`, por isso o polling

---

## Notas importantes

**staleTime default (0):**
- Nenhum hook define `staleTime` explicitamente, então usa o default do React Query: `0`
- Isso significa que todo dado é considerado stale imediatamente após ser fetched
- Consequência: qualquer re-focus na janela do navegador dispara um refetch de todas as queries ativas
- Impacto em produção: potencial aumento de carga no banco em abas muito acessadas
- Ver débito técnico em [[10-debitos-tecnicos]]

**useImport vs useOptimizedImport:**
- `useImport.ts` (811 linhas) e `useOptimizedImport.ts` (1028 linhas) parecem ter responsabilidades sobrepostas
- `useOptimizedImport` processa em batches de 100 e é o hook explicitamente chamado de `Import.tsx`
- `useImport` pode ser dead code — requer auditoria antes de refatorar
- Ver [[10-debitos-tecnicos]] para plano de ação

**useDashboardStats vs useEnhancedDashboard:**
- `useDashboardStats`: KPIs simples (contagens de payers e billings do mês corrente)
- `useEnhancedDashboard`: lançamentos financeiros com range de datas para gráficos avançados
- Possível sobreposição de responsabilidades — avaliar se podem ser unificados

---

## Links relacionados

- [[01-arquitetura]] — Contexto arquitetural do uso de React Query + Supabase
- [[06-componentes]] — Como os componentes consomem os hooks
