import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[];
  actor_user_id: string | null;
  actor_email: string | null;
  old_data: unknown | null;
  new_data: unknown | null;
  created_at: string;
};


const AUDITABLE_TABLES = [
  "affiliate_commissions",
  "affiliate_excursions",
  "affiliates",
  "audit_logs",
  "billings",
  "cards",
  "ceps",
  "cost_centers",
  "drivers",
  "dre_groups",
  "dre_subgroups",
  "excursion_orders",
  "excursions",
  "financial_entries",
  "financial_entry_allocations",
  "import_logs",
  "inspection_checklists",
  "landing_settings",
  "maintenance_tickets",
  "payers",
  "public_excursion_leads",
  "public_orders",
  "public_site_settings",
  "vehicles",
] as const;

const operationBadgeVariant = (operation: AuditRow["operation"]) => {
  if (operation === "INSERT") return "default" as const;
  if (operation === "DELETE") return "destructive" as const;
  return "outline" as const;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.map((v) => formatValue(v)).join(", ") : "-";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getFieldValue(row: AuditRow, field: string): { before: unknown; after: unknown } {
  const oldRec = toRecord(row.old_data);
  const newRec = toRecord(row.new_data);
  return {
    before: oldRec ? oldRec[field] : undefined,
    after: newRec ? newRec[field] : undefined,
  };
}


function getRowSearchText(row: AuditRow): string {
  const oldRec = toRecord(row.old_data);
  const newRec = toRecord(row.new_data);
  const name = (newRec?.name as string | undefined) || (oldRec?.name as string | undefined) || "";
  const documentDigits =
    (newRec?.document_digits as string | undefined) ||
    (oldRec?.document_digits as string | undefined) ||
    "";
  const document =
    (newRec?.document as string | undefined) ||
    (oldRec?.document as string | undefined) ||
    "";

  return [
    row.table_name,
    row.record_id || "",
    row.actor_email || "",
    row.actor_user_id || "",
    (row.changed_fields || []).join(" "),
    name,
    documentDigits,
    document,
  ]
    .join(" ")
    .toLowerCase();
}

function getEntitySummary(row: AuditRow) {
  const oldRec = toRecord(row.old_data);
  const newRec = toRecord(row.new_data);
  const from = newRec || oldRec || {};

  if (row.table_name === "payers") {
    const name = (from["name"] as string | undefined) || "-";
    const cpfDigits =
      (from["document_digits"] as string | undefined) ||
      (from["document"] as string | undefined) ||
      "-";
    return {
      title: "Pagador",
      primary: name,
      secondaryLabel: "CPF",
      secondary: cpfDigits,
    };
  }

  return {
    title: "Registro",
    primary: row.record_id || "-",
    secondaryLabel: "Tabela",
    secondary: row.table_name,
  };
}

function AuditDetails({ row }: { row: AuditRow }) {
  const summary = getEntitySummary(row);
  const changed = row.changed_fields || [];

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid gap-2 md:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Entidade</p>
          <p className="font-medium">{summary.title}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nome / Identificador</p>
          <p className="font-medium break-all">{summary.primary}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{summary.secondaryLabel}</p>
          <p className="font-mono text-xs break-all">{summary.secondary}</p>
        </div>
      </div>

      {changed.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Antes</TableHead>
                <TableHead>Depois</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changed.map((field) => {
                const { before, after } = getFieldValue(row, field);
                return (
                  <TableRow key={`${row.id}-${field}`}>
                    <TableCell className="font-mono text-xs">{field}</TableCell>
                    <TableCell className="text-xs break-all">{formatValue(before)}</TableCell>
                    <TableCell className="text-xs break-all">{formatValue(after)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Sem campos detalhados para exibir.</div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function Audit() {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: result, isLoading } = useQuery({
    queryKey: ["audit-logs", tableFilter, operationFilter, search, page],
    queryFn: async () => {
      const sb = supabase as any;
      let query = sb
        .from("audit_logs")
        .select(
          "id, table_name, record_id, operation, changed_fields, actor_user_id, actor_email, old_data, new_data, created_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (operationFilter !== "all") {
        query = query.eq("operation", operationFilter);
      }
      if (search.trim()) {
        query = query.or(
          `table_name.ilike.%${search}%,record_id.ilike.%${search}%,actor_email.ilike.%${search}%`
        );
      }

      const { data: rows, error, count } = await query.range(from, to);
      if (error) throw error;
      return { rows: (rows || []) as AuditRow[], count: count || 0 };
    },
  });

  const data = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tableOptions = useMemo(() => {
    const fromLogs = (data || []).map((r) => r.table_name);
    return Array.from(new Set([...AUDITABLE_TABLES, ...fromLogs])).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((row) => {
      const byTable = tableFilter === "all" || row.table_name === tableFilter;
      const byOp = operationFilter === "all" || row.operation === operationFilter;
      const haystack = getRowSearchText(row);
      return byTable && byOp && (!q || haystack.includes(q));
    });
  }, [data, tableFilter, operationFilter, search]);

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">
            Rastreabilidade de alterações no banco (insert, update, delete)
          </p>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <Input
                placeholder="Buscar por tabela, registro, usuário ou campo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas tabelas</SelectItem>
                  {tableOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={operationFilter} onValueChange={setOperationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas operações</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">Carregando auditoria...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">Nenhum evento encontrado</div>
            ) : (
              <>
                <div className="lg:hidden space-y-2">
                  {filtered.map((row) => {
                    const expanded = expandedRowId === row.id;
                    return (
                      <div key={row.id} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => setExpandedRowId(expanded ? null : row.id)}
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <span className="font-medium text-sm truncate">{row.table_name}</span>
                          </div>
                          <Badge variant={operationBadgeVariant(row.operation)} className="text-xs">
                            {row.operation}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("pt-BR")}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {row.record_id || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Campos: {row.changed_fields?.length ? row.changed_fields.join(", ") : "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.actor_email || row.actor_user_id || "sistema"}
                        </div>
                        {expanded && <AuditDetails row={row} />}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[46px]"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Campos alterados</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => {
                        const expanded = expandedRowId === row.id;
                        return (
                          <Fragment key={row.id}>
                            <TableRow key={row.id}>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedRowId(expanded ? null : row.id)}
                                >
                                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {new Date(row.created_at).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell className="font-medium">{row.table_name}</TableCell>
                              <TableCell>
                                <Badge variant={operationBadgeVariant(row.operation)}>{row.operation}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.record_id || "-"}</TableCell>
                              <TableCell className="text-xs">
                                {row.changed_fields?.length ? row.changed_fields.join(", ") : "-"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.actor_email || row.actor_user_id || "sistema"}
                              </TableCell>
                            </TableRow>
                            {expanded && (
                              <TableRow key={`${row.id}-details`}>
                                <TableCell colSpan={7}>
                                  <AuditDetails row={row} />
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PageTransition>
    </MainLayout>
  );
}
