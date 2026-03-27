import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Plus, Printer, Trash2, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WarningDialog } from "@/components/warnings/WarningDialog";
import { printWarning, type WarningData } from "@/lib/warning-pdf";

interface StudentWarning {
  id: string;
  aluno_nome: string;
  aluno_id: string | null;
  coordenador_nome: string;
  onibus_cor: string | null;
  data_ocorrencia: string;
  infracoes: string[];
  outro_motivo: string | null;
  gravidade: "LEVE_MODERADA" | "GRAVE";
  penalidade: "ADVERTENCIA_ESCRITA" | "SUSPENSAO" | "EXCLUSAO";
  numero_advertencia: number | null;
  suspensao_dias: number | null;
  suspensao_data_inicio: string | null;
  suspensao_data_fim: string | null;
  suspensao_motivo: "REINCIDENCIA" | "FALTA_GRAVE" | null;
  observacoes: string | null;
  created_at: string;
}

const INFRACOES_LABELS: Record<string, string> = {
  DESRESPEITO: "Desrespeito",
  BRIGAS: "Brigas",
  BARULHO: "Barulho",
  CONSUMO: "Consumo",
  LIMPEZA: "Limpeza",
  ASSENTOS: "Assentos",
  OUTRO: "Outro",
};

const PENALIDADE_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  ADVERTENCIA_ESCRITA: { label: "Advertência Escrita", variant: "secondary" },
  SUSPENSAO: { label: "Suspensão", variant: "outline" },
  EXCLUSAO: { label: "Exclusão", variant: "destructive" },
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function StudentWarnings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPenalidade, setFilterPenalidade] = useState<string>("ALL");

  const { data: warnings = [], isLoading } = useQuery({
    queryKey: ["student_warnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_warnings")
        .select("*")
        .order("data_ocorrencia", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as StudentWarning[];
    },
  });

  const filtered = warnings.filter((w) => {
    const matchSearch =
      !search ||
      w.aluno_nome.toLowerCase().includes(search.toLowerCase()) ||
      w.coordenador_nome.toLowerCase().includes(search.toLowerCase());
    const matchPenalidade = filterPenalidade === "ALL" || w.penalidade === filterPenalidade;
    return matchSearch && matchPenalidade;
  });

  async function handleDelete(id: string) {
    const { error } = await supabase.from("student_warnings").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir advertência");
    } else {
      toast.success("Advertência excluída");
      queryClient.invalidateQueries({ queryKey: ["student_warnings"] });
    }
  }

  function handleReprint(w: StudentWarning) {
    const data: WarningData = {
      aluno_nome: w.aluno_nome,
      coordenador_nome: w.coordenador_nome,
      onibus_cor: w.onibus_cor ?? undefined,
      data_ocorrencia: w.data_ocorrencia,
      infracoes: w.infracoes,
      outro_motivo: w.outro_motivo ?? undefined,
      gravidade: w.gravidade,
      penalidade: w.penalidade,
      numero_advertencia: w.numero_advertencia ?? undefined,
      suspensao_dias: w.suspensao_dias ?? undefined,
      suspensao_data_inicio: w.suspensao_data_inicio ?? undefined,
      suspensao_data_fim: w.suspensao_data_fim ?? undefined,
      suspensao_motivo: w.suspensao_motivo ?? undefined,
      observacoes: w.observacoes ?? undefined,
    };
    printWarning(data);
  }

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                Advertências
              </h1>
              <p className="text-muted-foreground text-sm">
                Registro de infrações ao regulamento de transporte
              </p>
            </div>
            <Button className="gap-2 self-start" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova Advertência
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por aluno ou coordenador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
                  value={filterPenalidade}
                  onChange={(e) => setFilterPenalidade(e.target.value)}
                >
                  <option value="ALL">Todas as penalidades</option>
                  <option value="ADVERTENCIA_ESCRITA">Advertência Escrita</option>
                  <option value="SUSPENSAO">Suspensão</option>
                  <option value="EXCLUSAO">Exclusão</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Total", value: warnings.length, color: "text-foreground" },
              { label: "Advertências", value: warnings.filter((w) => w.penalidade === "ADVERTENCIA_ESCRITA").length, color: "text-amber-600" },
              { label: "Suspensões", value: warnings.filter((w) => w.penalidade === "SUSPENSAO").length, color: "text-orange-600" },
              { label: "Exclusões", value: warnings.filter((w) => w.penalidade === "EXCLUSAO").length, color: "text-destructive" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Aluno(a)</TableHead>
                    <TableHead>Infrações</TableHead>
                    <TableHead>Gravidade</TableHead>
                    <TableHead>Penalidade</TableHead>
                    <TableHead>Coordenador</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search || filterPenalidade !== "ALL"
                          ? "Nenhum resultado para os filtros aplicados"
                          : "Nenhuma advertência registrada"}
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((w) => {
                    const pen = PENALIDADE_LABELS[w.penalidade];
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(w.data_ocorrencia)}</TableCell>
                        <TableCell className="font-medium text-sm">{w.aluno_nome}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {w.infracoes.map((inf) => (
                              <Badge key={inf} variant="outline" className="text-xs py-0">
                                {INFRACOES_LABELS[inf] ?? inf}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {w.gravidade === "GRAVE" ? (
                            <Badge variant="destructive" className="text-xs">Grave</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Leve/Mod.</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pen.variant} className="text-xs">{pen.label}</Badge>
                          {w.penalidade === "SUSPENSAO" && w.suspensao_dias && (
                            <span className="text-xs text-muted-foreground ml-1">({w.suspensao_dias}d)</span>
                          )}
                          {w.penalidade === "ADVERTENCIA_ESCRITA" && w.numero_advertencia && (
                            <span className="text-xs text-muted-foreground ml-1">(#{w.numero_advertencia})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{w.coordenador_nome}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleReprint(w)} className="gap-2">
                                <Printer className="h-4 w-4" />
                                Reimprimir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(w.id)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>

        </div>

        <WarningDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["student_warnings"] })}
        />
      </PageTransition>
    </MainLayout>
  );
}
