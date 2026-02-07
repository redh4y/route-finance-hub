import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, mapBillingStatus } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCPF, formatCurrency, formatMonthRef, formatPhone } from "@/lib/formatters";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Receipt,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Edit2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

interface PayerDetailsModalProps {
  payerId: string | null;
  onClose: () => void;
}

type Payer = Tables<"payers">;
type Billing = Tables<"billings">;

export function PayerDetailsModal({ payerId, onClose }: PayerDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Payer>>({});
  const queryClient = useQueryClient();

  const { data: payer, isLoading: payerLoading } = useQuery({
    queryKey: ["payer", payerId],
    queryFn: async () => {
      if (!payerId) return null;
      const { data, error } = await supabase
        .from("payers")
        .select("*")
        .eq("id", payerId)
        .single();
      if (error) throw error;
      return data as Payer;
    },
    enabled: !!payerId,
  });

  const { data: billings, isLoading: billingsLoading } = useQuery({
    queryKey: ["payer-billings", payerId],
    queryFn: async () => {
      if (!payerId) return [];
      const { data, error } = await supabase
        .from("billings")
        .select("*")
        .eq("payer_id", payerId)
        .order("reference_month", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data as Billing[];
    },
    enabled: !!payerId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Payer>) => {
      if (!payerId) throw new Error("No payer ID");
      const { error } = await supabase
        .from("payers")
        .update(updates)
        .eq("id", payerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payer", payerId] });
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      setIsEditing(false);
      toast.success("Pagador atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!payer) throw new Error("No payer");
      const newStatus = payer.status === "ATIVO" ? "INATIVO" : "ATIVO";
      const { error } = await supabase
        .from("payers")
        .update({ status: newStatus })
        .eq("id", payer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payer", payerId] });
      queryClient.invalidateQueries({ queryKey: ["payers"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleEdit = () => {
    if (payer) {
      setEditData({
        name: payer.name,
        document: payer.document,
        phone: payer.phone,
        email: payer.email,
        street: payer.street,
        number: payer.number,
        neighborhood: payer.neighborhood,
        city: payer.city,
        state: payer.state,
        cep: payer.cep,
        billing_mode: payer.billing_mode,
        default_route: payer.default_route,
        is_coordinator: payer.is_coordinator,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const isLoading = payerLoading || billingsLoading;

  return (
    <Dialog open={!!payerId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {payer?.name || "Detalhes do Pagador"}
          </DialogTitle>
          <DialogDescription>
            {payer?.payer_code && `Código: ${payer.payer_code}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : payer ? (
          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="billings">Cobranças</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              {/* Status and actions */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={payer.status === "ATIVO" ? "default" : "secondary"}>
                      {payer.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Método:</span>
                    <Badge variant="outline">{payer.billing_mode}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={payer.status === "ATIVO"}
                    onCheckedChange={() => toggleStatusMutation.mutate()}
                    disabled={toggleStatusMutation.isPending}
                  />
                  <span className="text-sm text-muted-foreground">
                    {payer.status === "ATIVO" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>

              {payer.needs_review && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-review/10 border border-review/20 text-review">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Este pagador precisa de revisão
                    {payer.review_reason && `: ${payer.review_reason}`}
                  </span>
                </div>
              )}

              {/* Edit form or display */}
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={editData.name || ""}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF/CNPJ</Label>
                        <Input
                          value={editData.document || ""}
                          onChange={(e) => setEditData({ ...editData, document: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={editData.phone || ""}
                          onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input
                          value={editData.email || ""}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Método de Cobrança</Label>
                        <Select
                          value={editData.billing_mode || "BOLETO"}
                          onValueChange={(v) => setEditData({ ...editData, billing_mode: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BOLETO">Boleto</SelectItem>
                            <SelectItem value="PIX_ONLY">PIX</SelectItem>
                            <SelectItem value="MIXED">Misto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Rota Padrão</Label>
                        <Select
                          value={editData.default_route || "DESCONHECIDO"}
                          onValueChange={(v) => setEditData({ ...editData, default_route: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BARRETOS">Barretos</SelectItem>
                            <SelectItem value="FRANCA">Franca</SelectItem>
                            <SelectItem value="DESCONHECIDO">Desconhecido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editData.is_coordinator || false}
                        onCheckedChange={(v) => setEditData({ ...editData, is_coordinator: v })}
                      />
                      <Label>Coordenador (nunca inativa automaticamente)</Label>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={User}
                        label="CPF/CNPJ"
                        value={payer.document_digits ? formatCPF(payer.document_digits) : "-"}
                      />
                      <InfoItem
                        icon={Phone}
                        label="Telefone"
                        value={payer.phone ? formatPhone(payer.phone) : "-"}
                      />
                      <InfoItem
                        icon={Mail}
                        label="E-mail"
                        value={payer.email || "-"}
                      />
                      <InfoItem
                        icon={Calendar}
                        label="Último Pagamento"
                        value={payer.last_payment_at 
                          ? new Date(payer.last_payment_at).toLocaleDateString("pt-BR")
                          : "Nunca"
                        }
                      />
                    </div>

                    {payer.is_coordinator && (
                      <div className="flex items-center gap-2 p-2 rounded bg-accent/10">
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                        <span className="text-sm">Coordenador</span>
                      </div>
                    )}

                    <Button variant="outline" onClick={handleEdit}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar Informações
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="billings" className="mt-4">
              <div className="space-y-2">
                {billings && billings.length > 0 ? (
                  billings.map((billing) => (
                    <motion.div
                      key={billing.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{formatMonthRef(billing.reference_month)}</p>
                          <p className="text-xs text-muted-foreground">
                            Venc: {billing.due_date 
                              ? new Date(billing.due_date).toLocaleDateString("pt-BR")
                              : "-"
                            }
                          </p>
                        </div>
                        <StatusBadge status={mapBillingStatus(billing.status)} />
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">
                          {formatCurrency(billing.amount_expected_cents)}
                        </p>
                        {billing.amount_paid_cents && (
                          <p className="text-xs text-success">
                            Pago: {formatCurrency(billing.amount_paid_cents)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma cobrança encontrada</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="address" className="mt-4">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="edit-address"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Rua</Label>
                        <Input
                          value={editData.street || ""}
                          onChange={(e) => setEditData({ ...editData, street: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input
                          value={editData.number || ""}
                          onChange={(e) => setEditData({ ...editData, number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input
                          value={editData.neighborhood || ""}
                          onChange={(e) => setEditData({ ...editData, neighborhood: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input
                          value={editData.city || ""}
                          onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input
                          value={editData.state || ""}
                          onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                          maxLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <Input
                          value={editData.cep || ""}
                          onChange={(e) => setEditData({ ...editData, cep: e.target.value })}
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display-address"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          {payer.match_ok ? (
                            <>
                              <p className="font-medium">
                                {payer.street}
                                {payer.number && `, ${payer.number}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {payer.neighborhood && `${payer.neighborhood}, `}
                                {payer.city} - {payer.state}
                              </p>
                              {payer.cep && (
                                <p className="text-sm font-mono text-muted-foreground">
                                  CEP: {payer.cep}
                                </p>
                              )}
                              <Badge variant="outline" className="mt-2 text-success border-success/50">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Endereço Validado
                              </Badge>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground italic">
                                {payer.address_original || "Endereço não informado"}
                              </p>
                              <Badge variant="outline" className="mt-2 text-destructive border-destructive/50">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Não Validado
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{payer.default_route}</Badge>
                      <span className="text-sm text-muted-foreground">Rota padrão</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
