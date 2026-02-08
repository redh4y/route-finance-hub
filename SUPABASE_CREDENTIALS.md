# Supabase Credentials - Route Finance Hub

> ⚠️ **ATENÇÃO**: Este arquivo contém credenciais sensíveis. NÃO commite para repositórios públicos!

## Credenciais do Projeto

### URLs e Chaves Públicas (podem ser usadas no frontend)

| Variável | Valor |
|----------|-------|
| **SUPABASE_URL** | `https://eivikyqudefultgzmbbq.supabase.co` |
| **SUPABASE_ANON_KEY** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdmlreXF1ZGVmdWx0Z3ptYmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjgxODIsImV4cCI6MjA4NjAwNDE4Mn0.poJ__S4M8bSfWGtmN8o-RpJjr5AjAy60DxcmKf6s3eA` |
| **PROJECT_REF** | `eivikyqudefultgzmbbq` |

### Chaves Sensíveis (APENAS backend/scripts)

| Variável | Onde Obter |
|----------|------------|
| **SUPABASE_SERVICE_ROLE_KEY** | Lovable Cloud → View Backend → Settings → API |
| **SUPABASE_ACCESS_TOKEN** | Lovable Cloud → View Backend → Settings → Access Tokens |
| **SUPABASE_DB_URL** | Lovable Cloud → View Backend → Settings → Database → Connection String |

## Uso com CLI/Codex

### 1. Configurar variáveis de ambiente

```bash
# .env.local (não commitar!)
SUPABASE_URL=https://eivikyqudefultgzmbbq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdmlreXF1ZGVmdWx0Z3ptYmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjgxODIsImV4cCI6MjA4NjAwNDE4Mn0.poJ__S4M8bSfWGtmN8o-RpJjr5AjAy60DxcmKf6s3eA
SUPABASE_SERVICE_ROLE_KEY=<obter do backend>
SUPABASE_ACCESS_TOKEN=<obter do backend>
```

### 2. Vincular projeto com Supabase CLI

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Vincular ao projeto
supabase link --project-ref eivikyqudefultgzmbbq

# Aplicar migrations
supabase db push
```

### 3. Gerar tipos TypeScript

```bash
supabase gen types typescript --project-id eivikyqudefultgzmbbq > src/integrations/supabase/types.ts
```

## Tabelas do Projeto

| Tabela | Descrição |
|--------|-----------|
| `payers` | Pagadores/alunos |
| `billings` | Boletos bancários |
| `financial_entries` | Lançamentos financeiros (receitas/despesas) |
| `installment_contracts` | Contratos de parcelamento (faturas) |
| `cards` | Cartões de crédito cadastrados |
| `dre_categories` | Categorias DRE |
| `ceps` | Cache de CEPs |
| `import_logs` | Logs de importação |

## Notas

- O projeto usa **Lovable Cloud** que é baseado em Supabase
- As políticas RLS estão configuradas como públicas (sem autenticação por usuário)
- Edge functions são deployadas automaticamente pelo Lovable
