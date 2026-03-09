import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: any;
  excursionId: string;
}

export function CancelOrderDialog({ open, onOpenChange, order, excursionId }: Props) {
  const [reason, setReason] = useState("");
  const [refundType, setRefundType] = useState<"TOTAL" | "PARCIAL" | "SEM_REEMBOLSO">("TOTAL");
  const qc = useQueryClient();

  const cancelMut = useMutation({
    mutationFn: async () => {
      const sb = supabase as any;
      // 1. Cancel the order
      const { error: orderErr } = await sb
        .from("public_orders")
        .update({
          status: "CANCELADO",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (orderErr) throw orderErr;

      // 2. Release seats
      if (order.seat_ids?.length > 0) {
        const { error: seatErr } = await supabase
          .from("excursion_seats")
          .update({ status: "DISPONIVEL", updated_at: new Date().toISOString() } as any)
          .in("id", order.seat_ids);
        if (seatErr) throw seatErr;
      }

      // 3. Log cancellation
      await sb.from("audit_logs").insert({
        table_name: "public_orders",
        record_id: order.id,
        operation: "CANCEL",
        new_data: {
          reason,
          refund_type: refundType,
          cancelled_at: new Date().toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Pedido cancelado e assentos liberados");
      qc.invalidateQueries({ queryKey: ["manifest-orders", excursionId] });
      qc.invalidateQueries({ queryKey: ["checkin-orders", excursionId] });
      qc.invalidateQueries({ queryKey: ["public-orders"] });
      qc.invalidateQueries({ queryKey: ["excursion-seats"] });
      onOpenChange(false);
      setReason("");
    },
    onError: () => toast.error("Erro ao cancelar pedido"),
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Cancelar Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-sm font-medium">{order.passenger_name}</p>
            <p className="text-xs text-muted-foreground">
              Assento(s): {order.seat_numbers?.join(", ")} · {order.status}
            </p>
          </div>

          <div>
            <Label>Tipo de reembolso</Label>
            <Select value={refundType} onValueChange={(v) => setRefundType(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOTAL">Reembolso total</SelectItem>
                <SelectItem value="PARCIAL">Reembolso parcial</SelectItem>
                <SelectItem value="SEM_REEMBOLSO">Sem reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Motivo do cancelamento</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
          >
            {cancelMut.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
