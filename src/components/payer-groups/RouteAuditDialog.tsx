import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Copy, Check, AlertTriangle, Users, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "./utils";

interface RouteAuditDialogProps {
  route: string;
  open: boolean;
  onClose: () => void;
}

type MemberRow = {
  id: string;
  payer_id: string;
  wa_display_name: string | null;
  payer: { id: string; name: string; document_digits: string | null } | null;
  group: { id: string; name: string; route: string | null } | null;
};

export function RouteAuditDialog({ route, open, onClose }: RouteAuditDialogProps) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: rawMembers = [], isLoading } = useQuery<MemberRow[]>({
    queryKey: ["route_audit_members", route],
    enabled: open,
    queryFn: async () => {
      // Fetch all active members of active groups for this route
      const { data, error } = await (supabase as any)
        .from("payer_group_members")
        .select(`
          id,
          payer_id,
          wa_display_name,
          payer:payers(id, name, document_digits),
          group:payer_groups(id, name, route)
        `)
        .eq("active", true);
      if (error) throw error;

      // Filter client-side by route (join filter on related table)
      return (data ?? []).filter(
        (m: MemberRow) => m.group?.route === route
      );
    },
  });

  // Group by payer_id to find duplicates
  const { uniqueMembers, duplicates } = useMemo(() => {
    const byPayer = new Map<string, MemberRow[]>();
    for (const m of rawMembers) {
      if (!m.payer_id) continue;
      const list = byPayer.get(m.payer_id) ?? [];
      list.push(m);
      byPayer.set(m.payer_id, list);
    }

    const unique: MemberRow[] = [];
    const dups: MemberRow[][] = [];

    for (const [, entries] of byPayer.entries()) {
      unique.push(entries[0]);
      if (entries.length > 1) dups.push(entries);
    }

    unique.sort((a, b) => (a.payer?.name ?? "").localeCompare(b.payer?.name ?? "", "pt-BR"));
    return { uniqueMembers: unique, duplicates: dups };
  }, [rawMembers]);

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await (supabase as any)
      .from("payer_group_members")
      .update({ active: false })
      .eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Membro removido do grupo.");
    qc.invalidateQueries({ queryKey: ["route_audit_members", route] });
    qc.invalidateQueries({ queryKey: ["payer_groups"] });
    qc.invalidateQueries({ queryKey: ["payer_group_members_all"] });
  };

  const handleCopyList = () => {
    const lines = ["Nome;CPF;Grupo", ...uniqueMembers.map((m) => {
      const name = m.payer?.name ?? m.wa_display_name ?? "—";
      const cpf = m.payer?.document_digits ?? "—";
      const group = m.group?.name ?? "—";
      const dupFlag = duplicates.some((d) => d.some((e) => e.payer_id === m.payer_id)) ? " (DUPLICADO)" : "";
      return `${name};${cpf};${group}${dupFlag}`;
    })];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Lista copiada para o clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Auditoria — Rota {toTitleCase(route)}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando dados…</div>
        ) : (
          <Tabs defaultValue="boletos" className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0">
              <TabsTrigger value="boletos" className="gap-2">
                <Users className="h-3.5 w-3.5" />
                Lista de Boletos
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                  {uniqueMembers.length} únicos
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="duplicates" className="gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Duplicatas
                {duplicates.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1.5">
                    {duplicates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Lista de Boletos ─────────────────────────────────────── */}
            <TabsContent value="boletos" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{uniqueMembers.length}</span> alunos únicos
                  {duplicates.length > 0 && (
                    <> · <span className="text-amber-600 font-semibold">{duplicates.length} com duplicata</span></>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyList}
                  className="gap-1.5 h-8"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar CSV
                </Button>
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 w-8">#</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="pr-4">Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueMembers.map((m, idx) => {
                      const isDup = duplicates.some((d) => d.some((e) => e.payer_id === m.payer_id));
                      return (
                        <TableRow key={m.id} className={isDup ? "bg-amber-50/60" : undefined}>
                          <TableCell className="pl-4 text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{m.payer?.name ?? m.wa_display_name ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {m.payer?.document_digits ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{m.group?.name ?? "—"}</TableCell>
                          <TableCell className="pr-4">
                            {isDup && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-2.5 w-2.5" /> duplicado
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {uniqueMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                          Nenhum membro vinculado a esta rota.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            {/* ── Duplicatas ───────────────────────────────────────────── */}
            <TabsContent value="duplicates" className="flex-1 min-h-0 mt-3 flex flex-col gap-3">
              {duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-sm gap-2">
                  <Check className="h-8 w-8 text-emerald-400" />
                  <p>Nenhuma duplicata encontrada nesta rota.</p>
                  <p className="text-xs">Cada aluno aparece em no máximo 1 grupo.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground shrink-0">
                    <span className="font-semibold text-destructive">{duplicates.length}</span> aluno{duplicates.length !== 1 ? "s" : ""} em mais de um grupo — podem gerar boletos duplicados.
                  </p>
                  <ScrollArea className="flex-1 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Aluno</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead className="pr-4 w-20">Remover</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {duplicates.map((entries) =>
                          entries.map((entry, ei) => (
                            <TableRow
                              key={entry.id}
                              className={ei === 0 ? "border-t-2 border-t-amber-200" : ""}
                            >
                              <TableCell className="pl-4 font-medium text-sm">
                                {ei === 0 ? (entry.payer?.name ?? "—") : ""}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {ei === 0 ? (entry.payer?.document_digits ?? "—") : ""}
                              </TableCell>
                              <TableCell className="text-sm">
                                <span className="flex items-center gap-1.5">
                                  {entry.group?.name ?? "—"}
                                  {ei > 0 && (
                                    <Badge variant="destructive" className="text-[10px]">extra</Badge>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="pr-4">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title={`Remover de "${entry.group?.name}"`}
                                  onClick={() => handleRemoveMember(entry.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
