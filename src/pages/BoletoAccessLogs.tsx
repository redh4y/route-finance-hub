import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function formatDateTime(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

type AccessLog = {
  id: string;
  created_at: string;
  action: "SEARCH" | "DOWNLOAD";
  cpf_digits: string;
  reference_month: string | null;
  student_name: string | null;
  drive_url: string | null;
  found_count: number | null;
};

const PAGE_SIZE = 50;

export default function BoletoAccessLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: result, isLoading } = useQuery({
    queryKey: ["public-boleto-access-logs", search, page],
    queryFn: async () => {
      let query = (supabase as any)
        .from("public_boleto_access_logs")
        .select("id,created_at,action,cpf_digits,reference_month,student_name,drive_url,found_count", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.or(
          `cpf_digits.ilike.%${search}%,student_name.ilike.%${search}%,reference_month.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      return { rows: (data || []) as AccessLog[], count: count || 0 };
    },
  });

  const rows = result?.rows || [];
  const total = result?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          <div className="page-header">
            <h1 className="page-title">Logs 2a via boletos</h1>
            <p className="page-subtitle">Auditoria de consultas e downloads no portal público.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:max-w-sm">
              <Label>Buscar</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="CPF, competência ou aluno"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Registros</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Resultados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDateTime(row.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={row.action === "DOWNLOAD" ? "default" : "outline"}>
                            {row.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.cpf_digits}</TableCell>
                        <TableCell>{row.reference_month || "-"}</TableCell>
                        <TableCell>{row.student_name || "-"}</TableCell>
                        <TableCell>{row.found_count ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                          Nenhum log encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    {total} registro{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
