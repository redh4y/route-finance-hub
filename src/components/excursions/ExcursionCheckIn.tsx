import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, CheckCircle2, Clock, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  excursionId: string;
}

type OrderRow = {
  id: string;
  passenger_name: string;
  passenger_document: string;
  passenger_phone: string;
  seat_numbers: number[];
  status: string;
  checked_in?: boolean;
};

export function ExcursionCheckIn({ excursionId }: Props) {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["checkin-orders", excursionId],
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("public_orders")
        .select("id,passenger_name,passenger_document,passenger_phone,seat_numbers,status,checked_in")
        .eq("excursion_id", excursionId)
        .in("status", ["VENDIDO", "RESERVADO"])
        .order("seat_numbers", { ascending: true });
      return (data || []) as OrderRow[];
    },
  });

  const checkInMut = useMutation({
    mutationFn: async ({ orderId, value }: { orderId: string; value: boolean }) => {
      const sb = supabase as any;
      const { error } = await sb
        .from("public_orders")
        .update({ checked_in: value })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, { value }) => {
      qc.invalidateQueries({ queryKey: ["checkin-orders", excursionId] });
      toast.success(value ? "Check-in realizado!" : "Check-in removido");
    },
    onError: () => toast.error("Erro ao atualizar check-in"),
  });

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.passenger_name?.toLowerCase().includes(q) ||
      o.passenger_document?.includes(q) ||
      o.seat_numbers?.some((s: number) => String(s).includes(q))
    );
  });

  const checkedIn = orders.filter((o) => o.checked_in).length;
  const total = orders.length;
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-primary" />
            Controle de Embarque
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {checkedIn}/{total} embarcados
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1.5">
            <Progress value={pct} className="h-3 flex-1" />
            <span className="text-sm font-bold tabular-nums w-12 text-right">{pct}%</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento ou assento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum passageiro encontrado</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {filtered.map((o) => (
              <div
                key={o.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  o.checked_in ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "p-1.5 rounded-full shrink-0",
                    o.checked_in ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
                  )}>
                    {o.checked_in ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.passenger_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Assento(s): <span className="font-mono font-bold">{o.seat_numbers?.join(", ")}</span>
                      {o.passenger_document && <span className="ml-2">· {o.passenger_document}</span>}
                    </p>
                  </div>
                </div>
                <Button
                  variant={o.checked_in ? "ghost" : "default"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => checkInMut.mutate({ orderId: o.id, value: !o.checked_in })}
                  disabled={checkInMut.isPending}
                >
                  {o.checked_in ? (
                    <>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Desfazer
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Check-in
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
