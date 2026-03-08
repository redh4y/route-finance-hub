import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
import { CreditCard, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type CardRecord = {
  id: string;
  name: string;
  card_last4: string | null;
  provider: string;
  closing_day: number | null;
  due_day: number | null;
  active: boolean;
  created_at: string;
};

export default function Cards() {
  const [name, setName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [provider, setProvider] = useState<"sicredi" | "generic">("sicredi");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [active, setActive] = useState(true);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editCardNumber, setEditCardNumber] = useState("");
  const [editProvider, setEditProvider] = useState<"sicredi" | "generic">("sicredi");
  const [editClosingDay, setEditClosingDay] = useState("");
  const [editDueDay, setEditDueDay] = useState("");
  const [editActive, setEditActive] = useState(true);

  const queryClient = useQueryClient();

  const { data: cards, isLoading } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("id, name, card_last4, provider, closing_day, due_day, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CardRecord[];
    },
  });

  const createCard = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do cartao");
      const closing = closingDay ? Number.parseInt(closingDay, 10) : null;
      const due = dueDay ? Number.parseInt(dueDay, 10) : null;
      const last4 = cardNumber.replace(/\D/g, "").slice(-4) || null;
      const { error } = await supabase.from("cards").insert({
        name: name.trim(),
        card_number: cardNumber.trim() || null,
        card_last4: last4,
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
      setCardNumber("");
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

  const updateCard = useMutation({
    mutationFn: async () => {
      if (!editingCard) return;
      if (!editName.trim()) throw new Error("Informe o nome do cartao");
      const closing = editClosingDay ? Number.parseInt(editClosingDay, 10) : null;
      const due = editDueDay ? Number.parseInt(editDueDay, 10) : null;
      const cleanNumber = editCardNumber.replace(/\D/g, "");
      const updatePayload: Record<string, any> = {
        name: editName.trim(),
        provider: editProvider,
        closing_day: Number.isNaN(closing) ? null : closing,
        due_day: Number.isNaN(due) ? null : due,
        active: editActive,
        updated_at: new Date().toISOString(),
      };
      if (cleanNumber) {
        updatePayload.card_number = editCardNumber.trim();
        updatePayload.card_last4 = cleanNumber.slice(-4);
      }
      const { error } = await supabase
        .from("cards")
        .update(updatePayload)
        .eq("id", editingCard.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setEditingCard(null);
      toast.success("Cartao atualizado");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const openEdit = (card: CardRecord) => {
    setEditingCard(card);
    setEditName(card.name);
    setEditCardNumber("");
    setEditProvider((card.provider as "sicredi" | "generic") || "sicredi");
    setEditClosingDay(card.closing_day ? String(card.closing_day) : "");
    setEditDueDay(card.due_day ? String(card.due_day) : "");
    setEditActive(card.active);
  };

  return (
    <MainLayout>
      <PageTransition>
      <div className="page-header">
        <h1 className="page-title">Cartões</h1>
        <p className="page-subtitle">Cadastre os cartões para importação de faturas</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form - full width on mobile, 1/3 on desktop */}
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Novo cart?o
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Numero do cartao</Label>
              <Input
                placeholder="**** 1234"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
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
                  Disponível para importação
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
              Cadastrar cart?o
            </Button>
          </CardContent>
        </Card>

        {/* Card list - full width on mobile, 2/3 on desktop */}
        <Card className="order-1 lg:order-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Cart?es cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : cards && cards.length > 0 ? (
              <>
                {/* Mobile: Card list */}
                <div className="lg:hidden space-y-3">
                  {cards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{card.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{card.provider}</span>
                          {card.card_last4 && (
                            <>
                              <span>?</span>
                              <span>Final {card.card_last4}</span>
                            </>
                          )}
                          <span>?</span>
                          <span>Fech: {card.closing_day ?? "-"}</span>
                          <span>?</span>
                          <span>Venc: {card.due_day ?? "-"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          checked={card.active}
                          onCheckedChange={(checked) =>
                            toggleCard.mutate({ id: card.id, active: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 group"
                          onClick={() => openEdit(card)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 group"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Excluir cartao?</DialogTitle>
                              <DialogDescription>
                                Esta acao nao pode ser desfeita. O cartao "{card.name}"
                                sera removido.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                              <Button variant="destructive" onClick={() => deleteCard.mutate(card.id)}>
                                Excluir
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Cartao</TableHead>
                        <TableHead>Fechamento</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[70px]">A??es</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cards.map((card) => (
                        <TableRow key={card.id}>
                          <TableCell className="font-medium">{card.name}</TableCell>
                          <TableCell>{card.provider}</TableCell>
                          <TableCell>{card.card_last4 ? `Final ${card.card_last4}` : "-"}</TableCell>
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
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="group" onClick={() => openEdit(card)}>
                                <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="group">
                                    <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Excluir cartao?</DialogTitle>
                                    <DialogDescription>
                                      Esta acao nao pode ser desfeita. O cartao "{card.name}"
                                      sera removido.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                                    <Button variant="destructive" onClick={() => deleteCard.mutate(card.id)}>
                                      Excluir
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum cart?o cadastrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cartao</DialogTitle>
            <DialogDescription>Atualize os dados do cartao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Numero do cartao</Label>
              <Input
                placeholder="**** 1234"
                value={editCardNumber}
                onChange={(e) => setEditCardNumber(e.target.value)}
              />
              {editingCard?.card_last4 && (
                <p className="text-xs text-muted-foreground">
                  Atual: Final {editingCard.card_last4}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={editProvider} onValueChange={(v) => setEditProvider(v as any)}>
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
                  value={editClosingDay}
                  onChange={(e) => setEditClosingDay(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  placeholder="Dia"
                  value={editDueDay}
                  onChange={(e) => setEditDueDay(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Disponivel para importacao</p>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingCard(null)}
              disabled={updateCard.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={() => updateCard.mutate()} disabled={updateCard.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageTransition>
    </MainLayout>
  );
}


