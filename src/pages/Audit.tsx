import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  operation: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[];
  actor_user_id: string | null;
  actor_email: string | null;
  created_at: string;
};

const operationBadgeVariant = (operation: AuditRow["operation"]) => {
  if (operation === "INSERT") return "default" as const;
  if (operation === "DELETE") return "destructive" as const;
  return "outline" as const;
};

export default function Audit() {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const sb = supabase as any;
      const { data: rows, error } = await sb
        .from("audit_logs")
        .select("id, table_name, record_id, operation, changed_fields, actor_user_id, actor_email, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (rows || []) as AuditRow[];
    },
  });

  const tableOptions = useMemo(() => Array.from(new Set((data || []).map((r) => r.table_name))).sort(), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((row) => {
      const byTable = tableFilter === "all" || row.table_name === tableFilter;
      const byOp = operationFilter === "all" || row.operation === operationFilter;
      const haystack = [row.table_name, row.record_id || "", row.actor_email || "", row.actor_user_id || "", (row.changed_fields || []).join(" ")].join(" ").toLowerCase();
      return byTable && byOp && (!q || haystack.includes(q));
    });
  }, [data, tableFilter, operationFilter, search]);

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">Rastreabilidade de alterações no banco (insert, update, delete)</p>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <Input placeholder="Buscar por tabela, registro, usuário ou campo..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas tabelas</SelectItem>
                  {tableOptions.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={operationFilter} onValueChange={setOperationFilter}>
                <SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger>
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
                {/* Mobile: Card list */}
                <div className="lg:hidden space-y-2">
                  {filtered.map((row) => (
                    <div key={row.id} className="p-3 rounded-lg border bg-card space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{row.table_name}</span>
                        <Badge variant={operationBadgeVariant(row.operation)} className="text-xs">{row.operation}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString("pt-BR")}
                      </div>
                      {row.record_id && (
                        <div className="text-xs text-muted-foreground font-mono truncate">ID: {row.record_id}</div>
                      )}
                      {row.changed_fields?.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          Campos: {row.changed_fields.join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {row.actor_email || row.actor_user_id || "sistema"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead>Campos alterados</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="font-medium">{row.table_name}</TableCell>
                          <TableCell><Badge variant={operationBadgeVariant(row.operation)}>{row.operation}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{row.record_id || "-"}</TableCell>
                          <TableCell className="text-xs">{row.changed_fields?.length ? row.changed_fields.join(", ") : "-"}</TableCell>
                          <TableCell className="text-xs">{row.actor_email || row.actor_user_id || "sistema"}</TableCell>
                        </TableRow>
                      ))}
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
