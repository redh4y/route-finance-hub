import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function BoletoAccessLogsPage() {
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["public-boleto-access-logs"],
    queryFn: async (): Promise<AccessLog[]> => {
      const { data, error } = await (supabase as any)
        .from("public_boleto_access_logs")
        .select("id,created_at,action,cpf_digits,reference_month,student_name,drive_url,found_count")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return (data || []) as AccessLog[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const haystack = [
        row.cpf_digits,
        row.action,
        row.reference_month || "",
        row.student_name || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search]);

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">
          <div className="page-header">
            <h1 className="page-title">Logs 2a via boletos</h1>
            <p className="page-subtitle">Auditoria de consultas e downloads no portal publico.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:max-w-sm">
              <Label>Buscar</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="CPF, acao, competencia ou aluno"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Registros</CardTitle>
              <Badge variant="secondary">{filtered.length}</Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[620px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/hora</TableHead>
                      <TableHead>Acao</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Competencia</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Resultados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
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
                    {!isLoading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                          Nenhum log encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
