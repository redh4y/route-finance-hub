# Fluxo de Dados

## 1. Autenticação

```
Usuário preenche email/senha
        ↓
Auth.tsx chama supabase.auth.signInWithPassword()
        ↓
Supabase Auth valida credenciais → retorna Session (JWT)
        ↓
AuthContext.tsx recebe via onAuthStateChange()
        ↓
AuthContext atualiza { user, session } no estado React
        ↓
React Router renderiza <ProtectedRoute>
        ↓
ProtectedRoute verifica user !== null
  ├── user existe → renderiza página solicitada
  └── user null   → redireciona para /auth
```

**Persistência:** a session é armazenada em `localStorage` pelo Supabase JS (`autoRefreshToken: true`). Ao recarregar a página, `onAuthStateChange` dispara com a sessão existente antes do primeiro render das rotas protegidas.

**Logout:** `supabase.auth.signOut()` via `AuthContext.signOut()` → limpa localStorage → `onAuthStateChange` dispara com `SIGNED_OUT` → `user` volta a null → redirect para `/auth`.

---

## 2. Data Fetching padrão (React Query + Supabase)

```
Componente monta / usuário interage
        ↓
Chama hook customizado (ex: usePayers())
        ↓
Hook usa useQuery({ queryKey: ["payers", filters], queryFn: ... })
        ↓
TanStack Query verifica cache:
  ├── cache válido (staleTime não expirado) → retorna dado cacheado
  └── cache ausente/stale → executa queryFn
             ↓
        queryFn chama Supabase JS:
        supabase.from("payers").select("...").eq("status", "ATIVO")
             ↓
        Supabase JS envia request HTTPS ao PostgreSQL
             ↓
        PostgreSQL avalia RLS + retorna rows
             ↓
        Supabase JS retorna { data, error }
             ↓
        TanStack Query armazena em cache + retorna ao componente
        ↓
Componente recebe { data, isLoading, error } e renderiza

--- Mutations ---
Usuário submete formulário
        ↓
Hook usa useMutation({ mutationFn: ... })
        ↓
mutationFn chama supabase.from("payers").insert/update/delete
        ↓
onSuccess: queryClient.invalidateQueries({ queryKey: ["payers"] })
        ↓
TanStack Query refetch automático → UI atualizada
```

**Nota:** `staleTime` não está configurado (usa default `0`), o que significa que todo re-focus na janela dispara refetch. Hooks de presença usam `refetchInterval: 15000–30000ms` para polling ativo.

---

## 3. Portal 2ª via de boletos

```
Aluno acessa /2-via-boletos (página pública)
        ↓
Digita CPF (últimos dígitos) + mês de referência
        ↓
Frontend chama Supabase:
  SELECT * FROM payer_boleto_links
  WHERE cpf_digits = X AND reference_month = 'YYYY-MM'
        ↓
Sistema registra log de SEARCH em public_boleto_access_logs
{ cpf_digits, reference_month, action: 'SEARCH', found_count }
        ↓
Resultados exibidos (nome do aluno, vencimento, valor, link)
        ↓
Aluno clica em "Baixar boleto"
        ↓
Frontend abre drive_url ou view_url em nova aba
+ registra log de DOWNLOAD em public_boleto_access_logs
{ cpf_digits, reference_month, action: 'DOWNLOAD', drive_url }
        ↓
--- Lado admin ---
BoletoAccessLogs.tsx (/logs/2via-boletos) cruza:
  payer_boleto_links (emitidos no mês)
  × public_boleto_access_logs (action='DOWNLOAD')
        ↓
Pagadores sem DOWNLOAD no mês = pendências
Exibidas como tabela com botão de contato WhatsApp (wa.me deeplink)
```

---

## 4. Importação de dados (CSV/Excel)

```
Operador acessa /importar
        ↓
Upload do arquivo (CSV ou XLSX)
        ↓
src/lib/csv-import.ts faz parse:
  - papaparse para CSV
  - xlsx para Excel
  - Normalização: CPF → document_digits, CEP, phone E.164
  - Trata notação científica do Excel via decimal.js
        ↓
Preview exibido na tela (Import.tsx)
Erros de validação destacados por linha
        ↓
Operador confirma importação
        ↓
useOptimizedImport.ts processa em batches de 100 items:
  - upsert em payers (conflict: document_digits)
  - upsert em payer_boleto_links (conflict: payer_id + reference_month)
        ↓
Registro de import_log criado:
{ type, file_name, total_rows, success_rows, error_rows,
  status, diff_summary (JSON), errors (JSON) }
        ↓
queryClient.invalidateQueries(["payers"]) + (["billings"])
        ↓
UI exibe resumo: X inseridos, Y atualizados, Z erros
```

---

## 5. Excursão pública (checkout com PIX)

```
Usuário acessa /public/excursoes/:token
        ↓
usePublicExcursion busca excursion por public_token
(apenas excursions com public_enabled = true)
        ↓
Mapa de assentos renderizado (DISPONIVEL / VENDIDO / BLOQUEADO)
        ↓
Usuário seleciona assentos
        ↓
Clique em "Reservar":
  RPC reserve_seats() é chamada:
  - Verifica disponibilidade
  - Cria public_order { status: RESERVADO, lock_expires_at: now+10min }
  - Atualiza excursion_seats { status: VENDIDO }
  - Gera PIX QR Code (pix_code)
        ↓
Tela de checkout exibe QR code + código PIX copia-e-cola
        ↓
Usuário paga no banco
        ↓
[Webhook/processo externo confirma pagamento]
        ↓
public_order.status → PAGO
        ↓
Se houver afiliado (affiliate_token na URL):
  affiliate_commissions criado:
  { amount_sold_cents, commission_cents calculado por tipo/valor }
        ↓
Função release_expired_locks() roda periodicamente:
  Libera assentos com lock_expires_at expirado e status ainda RESERVADO
```

---

## 6. Presença de aluno (check-in QR)

```
Aluno acessa /presenca/login
        ↓
Digite CPF → Edge Function student-auth:
  1. Valida formato CPF
  2. SELECT em payers WHERE document_digits = X AND status = 'ATIVO'
  3. Retorna student_id + dados
        ↓
AuthContext do módulo presença armazena student
        ↓
Aluno vai para /presenca/checkin
        ↓
Câmera ativada (html5-qrcode)
Lê QR code do ônibus (transport_buses.qr_code_value)
        ↓
useGeolocation captura latitude, longitude, accuracy
        ↓
Sistema verifica:
  - trip ativa para hoje nesta rota (trips tabela)
  - aluno dentro do raio geográfico da rota (transport_routes.radius_meters)
        ↓
Registro criado em attendance:
{ student_id, trip_id, bus_id, check_in_time, status: PRESENTE,
  method: QR_CODE, latitude, longitude, accuracy }
        ↓
Evento criado em attendance_events (FK attendance_id)
        ↓
StudentDashboard exibe confirmação
Histórico disponível em /presenca/historico
        ↓
--- Lado admin ---
AttendanceAdmin.tsx lista attendance em tempo real
(refetchInterval: 15s via useAttendance)
```

---

## Links relacionados

- [[07-api-e-endpoints]] — Schema das tabelas mencionadas nos fluxos
- [[08-estados-e-hooks]] — Hooks usados em cada fluxo
- [[04-regras-de-negocio]] — Regras de negócio aplicadas em cada fluxo
