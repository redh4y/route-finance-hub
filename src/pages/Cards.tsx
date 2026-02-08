import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type CardRecord = {
  id: string;
  name: string;
  provider: string;
  closing_day: number | null;
  due_day: number | null;
  active: boolean;
  created_at: string;
};

export default function Cards() {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"sicredi" | "generic">("sicredi");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [active, setActive] = useState(true);

  const queryClient = useQueryClient();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CardRecord[];
    },
  });

  const createCard = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do cartao");
      const closing = closingDay ? Number.parseInt(closingDay, 10) : null;
      const due = dueDay ? Number.parseInt(dueDay, 10) : null;
      const { error } = await supabase.from("cards").insert({
        name: name.trim(),
        provider,
        closing_day: Number.isNaN(closing) ? null : closing,
        due_day: Number.isNaN(due) ? null : due,
        active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setName("");
      setClosingDay("");
      setDueDay("");
      setActive(true);
      setProvider("sicredi");
      toast.success("Cartao cadastrado");
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const toggleCard = useMutation({
    mutationFn: async (payload: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("cards")
        .update({ active: payload.active, updated_at: new Date().toISOString() })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartao removido");
    },
    onError: (error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Cartoes</h1>
        <p className="page-subtitle">Cadastre os cartoes para importacao de faturas</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Novo cartao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sicredi">sicredi</SelectItem>
                  <SelectItem value="generic">generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input
                  placeholder="Dia"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  placeholder="Dia"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Disponivel para importacao
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <Button
              className="w-full"
              onClick={() => createCard.mutate()}
              disabled={createCard.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar cartao
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cartoes cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : cards && cards.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Fechamento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.name}</TableCell>
                      <TableCell>{card.provider}</TableCell>
                      <TableCell>{card.closing_day ?? "-"}</TableCell>
                      <TableCell>{card.due_day ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={card.active}
                            onCheckedChange={(checked) =>
                              toggleCard.mutate({ id: card.id, active: checked })
                            }
                          />
                          <Badge variant={card.active ? "secondary" : "outline"}>
                            {card.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCard.mutate(card.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhum cartao cadastrado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
