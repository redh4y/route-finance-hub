import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePublicExcursionByToken, usePublicSeats, useCreatePublicOrder } from "@/hooks/usePublicExcursion";
import { formatCurrency } from "@/lib/formatters";
import { MapPin, Calendar, Bus, Users, Clock, CheckCircle2, Copy, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TAVARES_WHATSAPP_URL } from "@/lib/contact";

const seatColors: Record<string, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer",
  RESERVADO: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  VENDIDO: "bg-zinc-700/40 text-zinc-500 border-zinc-600/40",
  BLOQUEADO: "bg-zinc-800/40 text-zinc-600 border-zinc-700/40",
};

type Step = "info" | "seats" | "payment" | "confirmation";

export default function PublicExcursion() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  const { data: excursion, isLoading } = usePublicExcursionByToken(token);
  const { data: seats } = usePublicSeats(excursion?.id);
  const createOrder = useCreatePublicOrder();

  // Resolve affiliate from ref code
  const { data: affiliateLink } = useQuery({
    queryKey: ["affiliate-ref", refCode, excursion?.id],
    enabled: !!refCode && !!excursion?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_excursions")
        .select("affiliate_id")
        .eq("affiliate_token", refCode!)
        .eq("excursion_id", excursion!.id)
        .maybeSingle();
      return data;
    },
  });

  const [step, setStep] = useState<Step>("info");
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [form, setForm] = useState({
    name: "", document: "", phone: "", email: "", address: "",
  });
  const [paymentType, setPaymentType] = useState<"TOTAL" | "PARCIAL">("TOTAL");
  const [orderResult, setOrderResult] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!excursion || !excursion.public_enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <Bus className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-bold mb-2">Excursão Indisponível</h2>
            <p className="text-muted-foreground mb-6">
              Esta excursão não está disponível para venda no momento.
            </p>
            <a
              href={TAVARES_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                <Phone className="h-4 w-4" />
                Falar no WhatsApp
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableSeats = (seats || []).filter((s) => s.status === "DISPONIVEL" && !s.blocked).length;
  const totalAmount = selectedSeats.length * excursion.seat_price_cents;
  const payAmount = paymentType === "TOTAL" ? totalAmount : Math.round(totalAmount * 0.5);

  const toggleSeat = (sn: number) => {
    const seat = seats?.find((s) => s.seat_number === sn);
    if (!seat || seat.status !== "DISPONIVEL" || seat.blocked) return;
    setSelectedSeats((prev) =>
      prev.includes(sn) ? prev.filter((n) => n !== sn) : [...prev, sn]
    );
  };

  const seatRows: number[][] = [];
  const totalS = seats?.length || excursion.total_seats;
  for (let i = 0; i < totalS; i += 4) {
    const row: number[] = [];
    for (let j = 0; j < 4 && i + j < totalS; j++) row.push(i + j + 1);
    seatRows.push(row);
  }

  const handleSubmitOrder = () => {
    if (!form.name || !form.document || !form.phone) {
      toast.error("Preencha nome, CPF e telefone");
      return;
    }
    if (selectedSeats.length === 0) {
      toast.error("Selecione ao menos um assento");
      return;
    }
    createOrder.mutate(
      {
        excursion_id: excursion.id,
        affiliate_id: affiliateLink?.affiliate_id,
        passenger_name: form.name,
        passenger_document: form.document,
        passenger_phone: form.phone,
        passenger_email: form.email || undefined,
        passenger_address: form.address || undefined,
        seat_numbers: selectedSeats,
        amount_total_cents: totalAmount,
        payment_type: paymentType,
        pix_expiration_minutes: excursion.pix_expiration_minutes || 30,
      },
      {
        onSuccess: (data) => {
          setOrderResult(data);
          setStep("confirmation");
        },
      }
    );
  };

  const copyPixCode = () => {
    if (orderResult?.pix_code) {
      navigator.clipboard.writeText(orderResult.pix_code);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Bus className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Tavares Transportes</h1>
              <p className="text-xs text-muted-foreground">Excursões & Viagens</p>
            </div>
          </div>
          <a href={TAVARES_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Excursion info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{excursion.name}</h2>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {excursion.destination}{excursion.destination_state ? `/${excursion.destination_state}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {new Date(excursion.departure_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    {" às "}
                    {new Date(excursion.departure_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {excursion.boarding_location && (
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 shrink-0" />
                      Embarque: {excursion.boarding_location}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    {availableSeats} vagas disponíveis
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">A partir de</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(excursion.seat_price_cents)}
                </p>
                <p className="text-xs text-muted-foreground">por assento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-6 text-sm overflow-x-auto">
          {(["info", "seats", "payment", "confirmation"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 shrink-0">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <div
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : (["info", "seats", "payment", "confirmation"].indexOf(step) > i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground")
                )}
              >
                {i + 1}. {s === "info" ? "Dados" : s === "seats" ? "Assentos" : s === "payment" ? "Pagamento" : "Confirmação"}
              </div>
            </div>
          ))}
        </div>

        {/* Step: Info */}
        {step === "info" && (
          <Card>
            <CardHeader>
              <CardTitle>Seus dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="João da Silva" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Endereço completo</Label>
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Rua, número, bairro, cidade/UF" />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!form.name || !form.document || !form.phone) {
                      toast.error("Preencha nome, CPF e telefone");
                      return;
                    }
                    setStep("seats");
                  }}
                >
                  Escolher Assentos →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Seats */}
        {step === "seats" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bus className="h-5 w-5" />
                Escolha seus assentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
                  Disponível
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-zinc-700/40 border border-zinc-600/50" />
                  Vendido
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50" />
                  Reservado
                </span>
                {selectedSeats.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-blue-500 border border-blue-400" />
                    Selecionado
                  </span>
                )}
              </div>

              {/* Bus layout */}
              <div className="bg-muted/30 rounded-lg p-4 border">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-6 rounded-t-xl bg-muted border border-b-0 flex items-center justify-center text-[10px] text-muted-foreground">
                    FRENTE
                  </div>
                </div>
                <div className="max-h-[400px] overflow-auto space-y-1.5">
                  {seatRows.map((row, ri) => (
                    <div key={ri} className="flex justify-center gap-1">
                      {row.map((sn, ci) => {
                        const seat = seats?.find((s) => s.seat_number === sn);
                        const status = seat?.blocked ? "BLOQUEADO" : seat?.status || "DISPONIVEL";
                        const isSelected = selectedSeats.includes(sn);
                        return (
                          <div key={sn} className="contents">
                            <button
                              onClick={() => toggleSeat(sn)}
                              className={cn(
                                "w-11 h-11 rounded border text-xs font-medium transition-all",
                                isSelected
                                  ? "bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/50"
                                  : seatColors[status] || seatColors.DISPONIVEL
                              )}
                              disabled={status !== "DISPONIVEL"}
                            >
                              {sn}
                            </button>
                            {ci === 1 && <div className="w-4" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {selectedSeats.length > 0 && (
                <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm">
                    <strong>{selectedSeats.length}</strong> assento(s): {selectedSeats.sort((a, b) => a - b).join(", ")}
                  </p>
                  <p className="text-lg font-bold mt-1">{formatCurrency(totalAmount)}</p>
                </div>
              )}

              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={() => setStep("info")}>← Voltar</Button>
                <Button
                  onClick={() => {
                    if (selectedSeats.length === 0) {
                      toast.error("Selecione ao menos um assento");
                      return;
                    }
                    setStep("payment");
                  }}
                >
                  Pagamento →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <Card>
            <CardHeader>
              <CardTitle>Pagamento via PIX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Resumo</p>
                <p className="font-medium">{form.name}</p>
                <p className="text-sm">{selectedSeats.length} assento(s): {selectedSeats.sort((a, b) => a - b).join(", ")}</p>
                <p className="text-lg font-bold">Total: {formatCurrency(totalAmount)}</p>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Modalidade de pagamento</Label>
                <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as "TOTAL" | "PARCIAL")}>
                  <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="TOTAL" id="total" className="mt-0.5" />
                    <label htmlFor="total" className="flex-1 cursor-pointer">
                      <p className="font-medium">Pagamento Total (100%)</p>
                      <p className="text-sm text-muted-foreground">Assento confirmado como VENDIDO</p>
                      <p className="text-lg font-bold text-primary mt-1">{formatCurrency(totalAmount)}</p>
                    </label>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="PARCIAL" id="parcial" className="mt-0.5" />
                    <label htmlFor="parcial" className="flex-1 cursor-pointer">
                      <p className="font-medium">Reserva (50%)</p>
                      <p className="text-sm text-muted-foreground">Assento reservado, saldo pendente</p>
                      <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(Math.round(totalAmount * 0.5))}</p>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>O PIX expira em {excursion.pix_expiration_minutes || 30} minutos</span>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("seats")}>← Voltar</Button>
                <Button
                  onClick={handleSubmitOrder}
                  disabled={createOrder.isPending}
                  className="gap-2"
                >
                  {createOrder.isPending ? "Gerando PIX..." : "Gerar PIX"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Confirmation */}
        {step === "confirmation" && orderResult && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-400" />
              <h2 className="text-2xl font-bold mb-2">Pedido Realizado!</h2>
              <p className="text-muted-foreground mb-6">
                {paymentType === "TOTAL"
                  ? "Seus assentos foram confirmados."
                  : "Seus assentos foram reservados. Complete o pagamento restante."}
              </p>

              <div className="max-w-sm mx-auto space-y-4">
                <div className="p-4 bg-muted rounded-lg text-left space-y-2">
                  <p className="text-sm text-muted-foreground">Valor a pagar via PIX</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(payAmount)}</p>
                  {paymentType === "PARCIAL" && (
                    <p className="text-sm text-amber-400">
                      Saldo pendente: {formatCurrency(totalAmount - payAmount)}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-card border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">PIX Copia e Cola</p>
                  <p className="text-xs font-mono break-all bg-muted p-2 rounded mb-3">
                    {orderResult.pix_code?.slice(0, 80)}...
                  </p>
                  <Button onClick={copyPixCode} variant="outline" className="w-full gap-2">
                    <Copy className="h-4 w-4" />
                    Copiar Código PIX
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expira em {excursion.pix_expiration_minutes || 30} minutos
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Tavares Transportes. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
