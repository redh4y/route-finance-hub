import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { MainLayout } from '@/components/layout/MainLayout'
import { PageTransition } from '@/components/ui/page-transition'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MessageCircle,
  AlertTriangle,
  Clock,
  Phone,
  Users,
  Upload,
  CheckCircle2,
  Loader2,
  Send,
  ExternalLink
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

type PayerLite = { id: string; name: string; phone: string | null }

type MessageItem = {
  id: string
  raw: string
  name: string | null
  phone: string | null
  status: 'ready' | 'no_phone' | 'no_match' | 'no_name' | 'multiple'
}

type SendState = 'pending' | 'sent' | 'blocked' | 'error'

type SendResultMap = Record<string, SendState>

function normalizePhoneDigits(input: string | null | undefined) {
  return String(input || '').replace(/\D/g, '')
}

function buildWhatsAppUrl(phone: string, message: string) {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function normalizeName(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function extractName(message: string) {
  const match = message.match(/^(?:Olá|Ola)\s+(.+?)[!\n\r]/i)
  if (!match) return null
  return match[1].trim()
}

async function parseMessages(file: File): Promise<string[]> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    return rows
      .map(r => (Array.isArray(r) ? String(r[0] ?? '').trim() : ''))
      .filter(Boolean)
  }

  const text = await file.text()
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      complete: results => {
        const messages = (results.data || [])
          .map(row => (Array.isArray(row) ? String(row[0] ?? '').trim() : ''))
          .filter(Boolean)
        resolve(messages)
      },
      error: err => reject(err)
    })
  })
}

export default function Overdue() {
  const [file, setFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isSendingBatch, setIsSendingBatch] = useState(false)
  const [sendResults, setSendResults] = useState<SendResultMap>({})

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  }, [])
  const currentMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const { data: payers } = useQuery({
    queryKey: ['payers-lite'],
    queryFn: async (): Promise<PayerLite[]> => {
      const { data, error } = await supabase
        .from('payers')
        .select('id, name, phone')
        .order('name', { ascending: true })
      if (error) throw error
      return (data || []) as PayerLite[]
    }
  })

  const payerIndex = useMemo(() => {
    const map = new Map<string, PayerLite>()
    const duplicates = new Set<string>()
    ;(payers || []).forEach(p => {
      const key = normalizeName(p.name || '')
      if (!key) return
      if (map.has(key)) {
        duplicates.add(key)
      } else {
        map.set(key, p)
      }
    })
    return { map, duplicates }
  }, [payers])

  const { data: overdueBillings } = useQuery({
    queryKey: ['overdue-billings', todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billings')
        .select('id, due_date, reference_month, status')
        .eq('status', 'OPEN')
        .lt('due_date', todayStr)
      if (error) throw error
      return data || []
    }
  })

  const overdueStats = useMemo(() => {
    const all = overdueBillings || []
    const total = all.length
    const month = all.filter(b => b.reference_month === currentMonth).length
    const priority = all.filter(
      b => b.due_date && b.due_date <= sevenDaysAgoStr
    ).length
    return { total, month, priority }
  }, [overdueBillings, currentMonth, sevenDaysAgoStr])

  const items = useMemo<MessageItem[]>(() => {
    return messages.map((raw, idx) => {
      const name = extractName(raw)
      if (!name) {
        return {
          id: String(idx),
          raw,
          name: null,
          phone: null,
          status: 'no_name'
        }
      }
      const key = normalizeName(name)
      if (payerIndex.duplicates.has(key)) {
        return { id: String(idx), raw, name, phone: null, status: 'multiple' }
      }
      const payer = payerIndex.map.get(key)
      if (!payer) {
        return { id: String(idx), raw, name, phone: null, status: 'no_match' }
      }
      if (!payer.phone) {
        return { id: String(idx), raw, name, phone: null, status: 'no_phone' }
      }
      return { id: String(idx), raw, name, phone: payer.phone, status: 'ready' }
    })
  }, [messages, payerIndex])

  const stats = useMemo(() => {
    const total = items.length
    const ready = items.filter(i => i.status === 'ready').length
    const noPhone = items.filter(i => i.status === 'no_phone').length
    const noMatch = items.filter(i => i.status === 'no_match').length
    const noName = items.filter(i => i.status === 'no_name').length
    const multiple = items.filter(i => i.status === 'multiple').length
    return { total, ready, noPhone, noMatch, noName, multiple }
  }, [items])

  const readyItems = useMemo(() => items.filter(i => i.status === 'ready'), [items])

  const sendSummary = useMemo(() => {
    const values = Object.values(sendResults)
    return {
      sent: values.filter(v => v === 'sent').length,
      blocked: values.filter(v => v === 'blocked').length,
      error: values.filter(v => v === 'error').length,
      pending: Math.max(readyItems.length - values.length, 0)
    }
  }, [readyItems.length, sendResults])

  const sendSingle = (item: MessageItem) => {
    if (item.status !== 'ready' || !item.phone) return
    const url = buildWhatsAppUrl(item.phone, item.raw)
    if (!url) {
      setSendResults(prev => ({ ...prev, [item.id]: 'error' }))
      return
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    setSendResults(prev => ({ ...prev, [item.id]: opened ? 'sent' : 'blocked' }))
  }

  const sendBatch = async () => {
    if (readyItems.length === 0) {
      toast.error('Nao ha mensagens prontas para envio.')
      return
    }

    setIsSendingBatch(true)
    let blocked = 0

    for (const item of readyItems) {
      const url = item.phone ? buildWhatsAppUrl(item.phone, item.raw) : null
      if (!url) {
        setSendResults(prev => ({ ...prev, [item.id]: 'error' }))
        continue
      }

      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (opened) {
        setSendResults(prev => ({ ...prev, [item.id]: 'sent' }))
      } else {
        blocked += 1
        setSendResults(prev => ({ ...prev, [item.id]: 'blocked' }))
      }

      await new Promise(resolve => setTimeout(resolve, 900))
    }

    setIsSendingBatch(false)

    if (blocked > 0) {
      toast.warning(`Envio concluido com ${blocked} bloqueio(s) de popup no navegador.`)
    } else {
      toast.success('Mensagens abertas no WhatsApp com sucesso.')
    }
  }

  const handleFile = async (f: File | null) => {
    if (!f) return
    setIsParsing(true)
    setFile(f)
    setSendResults({})
    const parsed = await parseMessages(f)
    setMessages(parsed)
    setIsParsing(false)
  }

  const copyMessage = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Boletos Atrasados</h1>
          <p className="page-subtitle">
            Acompanhe atrasos e prepare mensagens em lote via WhatsApp.
          </p>
        </div>

        {/* Import */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar mensagens (CSV/XLSX)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-accent bg-accent/5'
                  : file
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border hover:border-muted-foreground/50'
              }`}
              onDragOver={e => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setIsDragging(false)
                handleFile(e.dataTransfer.files?.[0] || null)
              }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => handleFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isParsing}
              />
              {file ? (
                <div className="space-y-2">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Arraste um arquivo aqui</p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar (CSV/XLSX)
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {file && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFile(null)
                    setMessages([])
                    setSendResults({})
                  }}
                  disabled={isParsing}
                >
                  Limpar
                </Button>
              )}
              <Button className="ml-auto" disabled={!file || isParsing}>
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Carregar mensagens
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Atrasados</p>
                  <p className="stat-value">{overdueStats.total}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning/40" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total de boletos vencidos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">No mês</p>
                  <p className="stat-value">{overdueStats.month}</p>
                </div>
                <Clock className="h-8 w-8 text-accent/40" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Vencidos no mês atual
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Prioridade</p>
                  <p className="stat-value">{overdueStats.priority}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive/40" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Vencidos há mais de 7 dias
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">Mensagens</p>
                  <p className="stat-value">{stats.total}</p>
                </div>
                <MessageCircle className="h-8 w-8 text-primary/40" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total de mensagens carregadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Prévia das mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px] pr-2">
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      Importe um arquivo para visualizar a fila de envio.
                    </p>
                  </div>
                ) : (
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[420px]">Pagador</TableHead>
                        <TableHead className="w-[180px]">Telefone</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[160px]">Envio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="min-w-0 max-w-[420px]">
                              <p className="font-medium truncate">
                                {item.name || '(nome não identificado)'}
                              </p>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs text-muted-foreground truncate cursor-help">
                                    {item.raw}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                                    {item.raw}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.phone || '-'}
                          </TableCell>
                          <TableCell>
                            {item.status === 'ready' && (
                              <Badge className="bg-success/10 text-success border-success/30">
                                Pronto
                              </Badge>
                            )}
                            {item.status === 'no_phone' && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning/50"
                              >
                                Sem telefone
                              </Badge>
                            )}
                            {item.status === 'no_match' && (
                              <Badge
                                variant="outline"
                                className="text-destructive border-destructive/50"
                              >
                                Sem match
                              </Badge>
                            )}
                            {item.status === 'no_name' && (
                              <Badge variant="outline">Sem nome</Badge>
                            )}
                            {item.status === 'multiple' && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning/50"
                              >
                                Nome duplicado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.status === 'ready' ? (
                              <Button size="sm" variant="outline" onClick={() => sendSingle(item)}>
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Enviar
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                            {sendResults[item.id] === 'sent' && (
                              <Badge className="ml-2 bg-success/10 text-success border-success/30">Enviado</Badge>
                            )}
                            {sendResults[item.id] === 'blocked' && (
                              <Badge variant="outline" className="ml-2 text-warning border-warning/50">Popup bloqueado</Badge>
                            )}
                            {sendResults[item.id] === 'error' && (
                              <Badge variant="outline" className="ml-2 text-destructive border-destructive/50">Erro</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                WhatsApp em lote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie mensagens automáticas sobre vencimentos.
              </p>
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium mb-2">Prévia da mensagem</p>
                <p className="text-muted-foreground">
                  Olá, {`{NOME}`}. Seu boleto venceu em {`{DATA}`}. Caso já
                  tenha realizado o pagamento, desconsidere.
                </p>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <p className="font-medium text-sm">
                  Regras de envio (em breve)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Janela: 09:00 - 18:00" disabled />
                  <Input placeholder="Limite: 30/min" disabled />
                </div>
                <Input placeholder="Dias úteis apenas" disabled />
              </div>
              <Button className="w-full" disabled>
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar mensagens (em breve)
              </Button>
              <p className="text-xs text-muted-foreground">
                Integração com bot WhatsApp será adicionada futuramente.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  )
}
