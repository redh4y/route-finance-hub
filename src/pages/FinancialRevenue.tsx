import React, { useState, useMemo } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTransition } from '@/components/ui/page-transition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  formatCurrency,
  formatDate,
  formatMonthRef,
  getCurrentMonthRef
} from '@/lib/formatters'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, mapBillingStatus } from '@/components/ui/status-badge'
import { ArrowUpCircle, Plus, Receipt, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useSearchParams } from 'react-router-dom'

interface Billing {
  id: string
  payer_id: string
  payer_code?: string | null
  reference_month: string
  due_date: string | null
  status: string
  amount_expected_cents: number
  amount_paid_cents: number | null
  settlement_at: string | null
  payers?: { name: string | null } | null
}

interface FinancialEntry {
  id: string
  competence_month: string
  date: string
  type: string
  category: string
  subcategory: string | null
  description: string
  amount_cents: number
  source: string
}

const BILLINGS_PAGE_SIZE = 50;

export default function FinancialRevenue() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRef())
  const [groupId, setGroupId] = useState('')
  const [subgroupId, setSubgroupId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status')
  const [billingsPage, setBillingsPage] = useState(1)
  const [entriesPage, setEntriesPage] = useState(1)

  const queryClient = useQueryClient()

  const { data: dreGroups } = useQuery({
    queryKey: ['dre-groups', 'RECEITA'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_groups')
        .select('id, name, nature')
        .eq('nature', 'RECEITA')
        .order('name', { ascending: true })
      if (error) throw error
      return data as { id: string; name: string; nature: string }[]
    }
  })

  const { data: dreSubgroups } = useQuery({
    queryKey: ['dre-subgroups', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dre_subgroups')
        .select('id, name, group_id')
        .eq('group_id', groupId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as { id: string; name: string; group_id: string }[]
    }
  })

  const { data: costCenters } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id, name, type, active')
        .eq('active', true)
        .order('name', { ascending: true })
      if (error) throw error
      return data as {
        id: string
        name: string
        type: string
        active: boolean
      }[]
    }
  })

  const groupById = useMemo(() => {
    const map = new Map<string, { name: string }>()
    ;(dreGroups || []).forEach(group => {
      map.set(group.id, { name: group.name })
    })
    return map
  }, [dreGroups])

  const subgroupById = useMemo(() => {
    const map = new Map<string, { name: string }>()
    ;(dreSubgroups || []).forEach(subgroup => {
      map.set(subgroup.id, { name: subgroup.name })
    })
    return map
  }, [dreSubgroups])

  // Reset pages when month/filter changes
  React.useEffect(() => {
    setBillingsPage(1)
    setEntriesPage(1)
  }, [selectedMonth, statusFilter])

  const billingsFrom = (billingsPage - 1) * BILLINGS_PAGE_SIZE
  const billingsTo = billingsFrom + BILLINGS_PAGE_SIZE - 1

  // Get billings for the month with server-side pagination
  const { data: billingsResult, isLoading: loadingBillings } = useQuery({
    queryKey: ['billings', selectedMonth, statusFilter, billingsPage],
    queryFn: async () => {
      let query = supabase
        .from('billings')
        .select('*, payers(name)', { count: 'exact' })
        .eq('reference_month', selectedMonth)
        .order('due_date', { ascending: true })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error, count } = await query.range(billingsFrom, billingsTo)

      if (error) throw error
      return { rows: data as Billing[], count: count || 0 }
    }
  })

  const billings = billingsResult?.rows || []
  const totalBillings = billingsResult?.count || 0
  const totalBillingsPages = Math.max(1, Math.ceil(totalBillings / BILLINGS_PAGE_SIZE))

  const billingIds = useMemo(
    () => billings.map((b) => b.id),
    [billings]
  )

  const { data: dueDateChangedIds } = useQuery({
    queryKey: ['billings-due-date-changes', selectedMonth, billingIds],
    enabled: billingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('record_id')
        .eq('table_name', 'billings')
        .eq('operation', 'UPDATE')
        .contains('changed_fields', ['due_date'])
        .in('record_id', billingIds)

      if (error) throw error
      return new Set((data || []).map((row) => row.record_id).filter(Boolean) as string[])
    }
  })

  const entriesFrom = (entriesPage - 1) * BILLINGS_PAGE_SIZE
  const entriesTo = entriesFrom + BILLINGS_PAGE_SIZE - 1

  // Get manual revenue entries with pagination
  const { data: entriesResult, isLoading: loadingEntries } = useQuery({
    queryKey: ['financial-entries', selectedMonth, 'revenue', entriesPage],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('financial_entries')
        .select('*', { count: 'exact' })
        .eq('competence_month', selectedMonth)
        .eq('type', 'RECEITA')
        .eq('source', 'MANUAL')
        .order('date', { ascending: false })
        .range(entriesFrom, entriesTo)

      if (error) throw error
      return { rows: data as FinancialEntry[], count: count || 0 }
    }
  })

  const entries = entriesResult?.rows || []
  const totalEntries = entriesResult?.count || 0
  const totalEntriesPages = Math.max(1, Math.ceil(totalEntries / BILLINGS_PAGE_SIZE))

  // Summary stats using server-side aggregation (no row limit)
  const { data: billingSummary } = useQuery({
    queryKey: ['billings-summary', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_billings_summary', {
        p_month: selectedMonth,
      })
      if (error) throw error
      const result = data as {
        expected_revenue: number
        paid_revenue: number
        pending_revenue: number
      }
      return {
        expectedRevenue: result.expected_revenue || 0,
        paidRevenue: result.paid_revenue || 0,
        pendingRevenue: result.pending_revenue || 0,
      }
    }
  })

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!groupId) {
        throw new Error('Selecione um grupo.')
      }
      if ((dreSubgroups?.length || 0) > 0 && !subgroupId) {
        throw new Error('Selecione um subgrupo.')
      }
      const amountCents = Math.round(parseFloat(amount.replace(',', '.')) * 100)
      const group = groupById.get(groupId)
      const subgroup = subgroupId ? subgroupById.get(subgroupId) : null

      const { error } = await supabase.from('financial_entries').insert({
        competence_month: selectedMonth,
        date,
        type: 'RECEITA',
        category: group?.name || '',
        subcategory: subgroup?.name || null,
        description,
        amount_cents: amountCents,
        source: 'MANUAL',
        group_id: groupId,
        subgroup_id: subgroupId || null,
        cost_center_id: costCenterId || null
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-entries'] })
      queryClient.invalidateQueries({ queryKey: ['billings-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dre'] })
      toast.success('Receita registrada com sucesso')
      setGroupId('')
      setSubgroupId('')
      setCostCenterId('')
      setDescription('')
      setAmount('')
    },
    onError: error => {
      toast.error('Erro ao registrar receita: ' + error.message)
    }
  })

  const hasSubgroups = (dreSubgroups?.length || 0) > 0

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Totals from server-side summary (handles >1000 rows)
  const expectedRevenue = billingSummary?.expectedRevenue || 0
  const manualRevenue = entries.reduce((sum, e) => sum + e.amount_cents, 0)
  const actualRevenue = (billingSummary?.paidRevenue || 0) + manualRevenue
  const pendingRevenue = billingSummary?.pendingRevenue || 0

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="page-title">Entradas</h1>
              <p className="page-subtitle">Receitas e cobranças</p>
            </div>
            <div className="flex items-center gap-3">
              {statusFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.delete('status')
                    setSearchParams(next)
                  }}
                >
                  Limpar filtro
                </Button>
              )}
              {statusFilter && (
                <Badge variant="outline">Status: {statusFilter}</Badge>
              )}
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month} value={month}>
                      {formatMonthRef(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="finance-card-neutral">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Entrada Presumida</p>
                  <p className="stat-value">
                    {formatCurrency(expectedRevenue)}
                  </p>
                </div>
                <Receipt className="h-8 w-8 text-accent/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="finance-card-positive">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Entrada Atual</p>
                  <p className="stat-value text-success">
                    {formatCurrency(actualRevenue)}
                  </p>
                </div>
                <ArrowUpCircle className="h-8 w-8 text-success/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="finance-card-warning">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Pendente</p>
                  <p className="stat-value text-warning">
                    {formatCurrency(pendingRevenue)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-warning/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Receitas Manuais</p>
                  <p className="stat-value">{formatCurrency(manualRevenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nova Receita Manual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select
                  value={groupId}
                  onValueChange={v => {
                    setGroupId(v)
                    setSubgroupId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dreGroups?.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasSubgroups && (
                <div className="space-y-2">
                  <Label>Subgrupo</Label>
                  <Select value={subgroupId} onValueChange={setSubgroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dreSubgroups?.map(subgroup => (
                        <SelectItem key={subgroup.id} value={subgroup.id}>
                          {subgroup.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Centro de custo (opcional)</Label>
                <Select
                  value={costCenterId || ''}
                  onValueChange={value =>
                    setCostCenterId(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      Sem centro de custo
                    </SelectItem>
                    {costCenters?.map(center => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descrição da receita..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => createEntry.mutate()}
                disabled={
                  !groupId ||
                  (hasSubgroups && !subgroupId) ||
                  !amount ||
                  !description ||
                  createEntry.isPending
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Registrar Receita
              </Button>
            </CardContent>
          </Card>

          {/* Billings list */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Boletos do Mês - {formatMonthRef(selectedMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBillings ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : billings.length > 0 ? (
                  <div>
                    {/* Mobile: Card list */}
                    <div className="lg:hidden space-y-2 p-1">
                      {billings.map(billing => (
                        <div key={billing.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{billing.payers?.name || billing.payer_id}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{billing.due_date ? formatDate(billing.due_date) : '-'}</span>
                              {dueDateChangedIds?.has(billing.id) && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 bg-amber-500/10">
                                  Venc. alterado
                                </Badge>
                              )}
                              <StatusBadge status={mapBillingStatus(billing.status)} />
                            </div>
                          </div>
                          <span className="font-mono text-sm ml-2 shrink-0">{formatCurrency(billing.amount_expected_cents)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Desktop: Table */}
                    <div className="hidden lg:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Pagador</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billings.map(billing => (
                            <TableRow key={billing.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{billing.due_date ? formatDate(billing.due_date) : '-'}</span>
                                  {dueDateChangedIds?.has(billing.id) && (
                                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 bg-amber-500/10">
                                      Venc. alterado
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{billing.payers?.name || billing.payer_id}</TableCell>
                              <TableCell><StatusBadge status={mapBillingStatus(billing.status)} /></TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(billing.amount_expected_cents)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Pagination */}
                    {totalBillingsPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <p className="text-sm text-muted-foreground">
                          {totalBillings} boleto{totalBillings !== 1 ? 's' : ''} · Página {billingsPage} de {totalBillingsPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={billingsPage <= 1}
                            onClick={() => setBillingsPage(p => p - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={billingsPage >= totalBillingsPages}
                            onClick={() => setBillingsPage(p => p + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum boleto neste mês
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual entries */}
            {entries && entries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Receitas Manuais</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Mobile: Card list */}
                  <div className="lg:hidden space-y-2">
                    {entries.map(entry => (
                      <div key={entry.id} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{entry.description}</span>
                          <span className="font-mono text-sm text-success shrink-0 ml-2">+{formatCurrency(entry.amount_cents)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(entry.date)}</span>
                          <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: Table */}
                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.category}</Badge>
                              {entry.subcategory && <div className="text-xs text-muted-foreground mt-1">{entry.subcategory}</div>}
                            </TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right font-mono text-success">+{formatCurrency(entry.amount_cents)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination */}
                  {totalEntriesPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <p className="text-sm text-muted-foreground">
                        {totalEntries} receita{totalEntries !== 1 ? 's' : ''} · Página {entriesPage} de {totalEntriesPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={entriesPage <= 1}
                          onClick={() => setEntriesPage(p => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={entriesPage >= totalEntriesPages}
                          onClick={() => setEntriesPage(p => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </PageTransition>
    </MainLayout>
  )
}
