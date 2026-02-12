import { useState, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  usePublicExcursionByToken,
  usePublicSeats,
  useCreatePublicOrder,
  useCapturePublicLead,
  useUpdatePublicLeadStage,
} from "@/hooks/usePublicExcursion";
import { formatCurrency } from "@/lib/formatters";
import { Bus, CheckCircle2, Copy, Phone, Clock, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TAVARES_WHATSAPP_URL } from "@/lib/contact";
import { CheckoutStepper, type Step } from "@/components/checkout/CheckoutStepper";
import { TripSummaryCard } from "@/components/checkout/TripSummaryCard";
import { SeatMap } from "@/components/checkout/SeatMap";

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const formatPhoneBr = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

type FieldErrors = Record<string, string>;

export default function PublicExcursion() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  const { data: excursion, isLoading } = usePublicExcursionByToken(token);
  const { data: seats } = usePublicSeats(excursion?.id);
  const createOrder = useCreatePublicOrder();
  const captureLead = useCapturePublicLead();
  const updateLeadStage = useUpdatePublicLeadStage();

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
  const [form, setForm] = useState({ name: "", document: "", phone: "", email: "", address: "" });
  const [paymentType, setPaymentType] = useState<"TOTAL" | "PARCIAL">("TOTAL");
  const [orderResult, setOrderResult] = useState<any>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLDivElement>(null);

  const availableSeats = useMemo(
    () => (seats || []).filter((s) => s.status === "DISPONIVEL" && !s.blocked).length,
    [seats]
  );

  const totalAmount = selectedSeats.length * (excursion?.seat_price_cents || 0);
  const payAmount = paymentType === "TOTAL" ? totalAmount : Math.round(totalAmount * 0.5);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando excursão...</p>
        </div>
      </div>
    );
  }

  if (!excursion || !excursion.public_enabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center bg-card border rounded-xl p-8">
          <Bus className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-xl font-bold mb-2">Excursão indisponível</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Esta excursão não está disponível para venda no momento.
          </p>
          <a href={TAVARES_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 w-full">
              <Phone className="h-4 w-4" />
              Falar no WhatsApp
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const toggleSeat = (sn: number) => {
    const seat = seats?.find((s) => s.seat_number === sn);
    if (!seat || seat.status !== "DISPONIVEL" || seat.blocked) return;
    setSelectedSeats((prev) =>
      prev.includes(sn) ? prev.filter((n) => n !== sn) : [...prev, sn]
    );
  };

  const validateInfo = (): boolean => {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Informe seu nome completo";
    const cpfDigits = form.document.replace(/\D/g, "");
    if (cpfDigits.length !== 11) errors.document = "CPF deve ter 11 dígitos";
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) errors.phone = "Informe um WhatsApp válido";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "E-mail inválido";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstErrorField = formRef.current?.querySelector(`[data-field="${Object.keys(errors)[0]}"]`);
      if (firstErrorField) (firstErrorField as HTMLElement).focus();
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    if (!form.name || !form.document || !form.phone) {
      toast.error("Preencha nome, CPF e telefone");
      return;
    }
    if (selectedSeats.length === 0) {
      toast.error("Selecione ao menos um assento");
      return;
    }
    if (leadId) {
      try {
        await updateLeadStage.mutateAsync({
          lead_id: leadId,
          status: "PIX_GERADO",
          seat_count: selectedSeats.length,
          amount_total_cents: totalAmount,
          payment_type: paymentType,
        });
      } catch (e: any) {
        toast.error(`Falha ao atualizar lead: ${e.message || "tente novamente"}`);
      }
    }
    createOrder.mutate(
      {
        excursion_token: token!,
        affiliate_id: affiliateLink?.affiliate_id,
        passenger_name: form.name,
        passenger_document: form.document,
        passenger_phone: form.phone,
        passenger_email: form.email || undefined,
        passenger_address: form.address || undefined,
        seat_numbers: selectedSeats,
        payment_type: paymentType,
      },
      {
        onSuccess: async (data) => {
          if (leadId) {
            await updateLeadStage.mutateAsync({
              lead_id: leadId,
              status: paymentType === "TOTAL" ? "CONVERTIDO" : "RESERVADO",
              seat_count: selectedSeats.length,
              amount_total_cents: totalAmount,
              payment_type: paymentType,
              order_id: data?.order_id || null,
            });
          }
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

  const summaryProps = {
    excursion,
    availableSeats,
    totalSeats: excursion.total_seats,
    selectedSeats,
    paymentType,
    step,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Bus className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm">Tavares Transportes</p>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Excursões & Viagens</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              Excursão &gt; Checkout
            </span>
            <a href={TAVARES_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Mobile summary - collapsible */}
        <div className="lg:hidden mb-4">
          <TripSummaryCard {...summaryProps} collapsible />
        </div>

        {/* Stepper */}
        <div className="mb-6 max-w-lg mx-auto lg:max-w-none lg:mx-0 lg:max-w-[calc(100%-380px)]">
          <CheckoutStepper current={step} />
        </div>

        {/* Split layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column: main checkout flow */}
          <div className="flex-1 min-w-0">
            {/* Step: Info */}
            {step === "info" && (
              <div className="bg-card border rounded-xl p-5 sm:p-6" ref={formRef}>
                <h2 className="text-lg font-bold mb-1">Seus dados</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Preencha seus dados para continuar com a reserva.
                </p>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nome completo *</Label>
                    <Input
                      id="name"
                      data-field="name"
                      value={form.name}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, name: e.target.value }));
                        if (fieldErrors.name) setFieldErrors((e) => ({ ...e, name: "" }));
                      }}
                      placeholder="João da Silva"
                      aria-invalid={!!fieldErrors.name}
                    />
                    {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        data-field="document"
                        value={form.document}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, document: formatCpf(e.target.value) }));
                          if (fieldErrors.document) setFieldErrors((e) => ({ ...e, document: "" }));
                        }}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        maxLength={14}
                        aria-invalid={!!fieldErrors.document}
                      />
                      {fieldErrors.document && <p className="text-xs text-destructive">{fieldErrors.document}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">WhatsApp *</Label>
                      <Input
                        id="phone"
                        data-field="phone"
                        value={form.phone}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, phone: formatPhoneBr(e.target.value) }));
                          if (fieldErrors.phone) setFieldErrors((e) => ({ ...e, phone: "" }));
                        }}
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                        maxLength={15}
                        aria-invalid={!!fieldErrors.phone}
                      />
                      {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      data-field="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, email: e.target.value }));
                        if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: "" }));
                      }}
                      placeholder="seu@email.com"
                      aria-invalid={!!fieldErrors.email}
                    />
                    {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Endereço completo</Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade/UF"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <Button
                    onClick={async () => {
                      if (!validateInfo()) return;
                      if (!excursion?.id || !token) return;

                      try {
                        const sidKey = "public_excursion_session_id";
                        let sessionId = sessionStorage.getItem(sidKey);
                        if (!sessionId) {
                          sessionId = crypto.randomUUID();
                          sessionStorage.setItem(sidKey, sessionId);
                        }

                        const lead = await captureLead.mutateAsync({
                          excursion_id: excursion.id,
                          public_token: token,
                          affiliate_id: affiliateLink?.affiliate_id || null,
                          ref_code: refCode,
                          source: refCode ? "affiliate" : "public_excursoes",
                          name: form.name,
                          cpf: form.document,
                          phone: form.phone,
                          email: form.email || undefined,
                          address: form.address || undefined,
                          session_id: sessionId,
                          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                        });

                        setLeadId(lead.id);
                        await updateLeadStage.mutateAsync({
                          lead_id: lead.id,
                          status: "INTERESSE_ASSENTOS",
                          seat_count: 0,
                          amount_total_cents: 0,
                        });
                        setStep("seats");
                      } catch (e: any) {
                        toast.error(`Erro ao capturar lead: ${e.message || "tente novamente"}`);
                      }
                    }}
                    className="gap-2"
                    disabled={captureLead.isPending || updateLeadStage.isPending}
                  >
                    Escolher assentos
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Seats */}
            {step === "seats" && (
              <div className="bg-card border rounded-xl p-5 sm:p-6">
                <h2 className="text-lg font-bold mb-1">Escolha seus assentos</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Toque nos assentos disponíveis para selecioná-los.
                </p>

                <SeatMap
                  seats={seats}
                  totalSeats={excursion.total_seats}
                  selectedSeats={selectedSeats}
                  onToggleSeat={toggleSeat}
                />

                {selectedSeats.length > 0 && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/15">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {selectedSeats.length} assento(s) selecionado(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assentos: {selectedSeats.sort((a, b) => a - b).join(", ")}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button variant="ghost" onClick={() => setStep("info")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                <Button
                  onClick={async () => {
                    if (selectedSeats.length === 0) {
                      toast.error("Selecione ao menos um assento");
                      return;
                    }
                    if (leadId) {
                      await updateLeadStage.mutateAsync({
                        lead_id: leadId,
                        status: "INTERESSE_ASSENTOS",
                        seat_count: selectedSeats.length,
                        amount_total_cents: totalAmount,
                      });
                    }
                    setStep("payment");
                  }}
                  className="gap-2"
                  >
                    Pagamento
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Payment */}
            {step === "payment" && (
              <div className="bg-card border rounded-xl p-5 sm:p-6">
                <h2 className="text-lg font-bold mb-1">Pagamento via PIX</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Escolha a modalidade de pagamento. Você poderá revisar antes de confirmar.
                </p>

                <div className="space-y-3 mb-6">
                  <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as "TOTAL" | "PARCIAL")}>
                    <label
                      htmlFor="total"
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                        paymentType === "TOTAL"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <RadioGroupItem value="TOTAL" id="total" className="mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Pagamento integral</p>
                        <p className="text-xs text-muted-foreground">Assento confirmado como vendido</p>
                        <p className="text-lg font-bold text-primary mt-1">{formatCurrency(totalAmount)}</p>
                      </div>
                    </label>
                    <label
                      htmlFor="parcial"
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                        paymentType === "PARCIAL"
                          ? "border-warning bg-warning/5"
                          : "border-border hover:border-warning/30"
                      )}
                    >
                      <RadioGroupItem value="PARCIAL" id="parcial" className="mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Reserva com entrada de 50%</p>
                        <p className="text-xs text-muted-foreground">Assento reservado, saldo pendente</p>
                        <p className="text-lg font-bold text-warning mt-1">
                          {formatCurrency(Math.round(totalAmount * 0.5))}
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>O código PIX expira em {excursion.pix_expiration_minutes || 30} minutos após ser gerado.</span>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("seats")} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSubmitOrder}
                    disabled={createOrder.isPending}
                    className="gap-2"
                    size="lg"
                  >
                    {createOrder.isPending ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Confirmar e gerar PIX
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Confirmation */}
            {step === "confirmation" && orderResult && (
              <div className="bg-card border rounded-xl p-5 sm:p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h2 className="text-xl font-bold mb-1">Pedido realizado!</h2>
                  <p className="text-sm text-muted-foreground">
                    {paymentType === "TOTAL"
                      ? "Seus assentos foram confirmados. Efetue o pagamento abaixo."
                      : "Seus assentos foram reservados. Pague a entrada para garantir."}
                  </p>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/15 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor a pagar via PIX</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(payAmount)}</p>
                    {paymentType === "PARCIAL" && (
                      <p className="text-sm text-warning mt-1">
                        Saldo pendente: {formatCurrency(totalAmount - payAmount)}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-card border rounded-xl space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      PIX Copia e Cola
                    </p>
                    <div className="bg-muted rounded-lg p-3 max-h-20 overflow-y-auto">
                      <p className="text-xs font-mono break-all select-all">
                        {orderResult.pix_code}
                      </p>
                    </div>
                    <Button onClick={copyPixCode} variant="outline" className="w-full gap-2">
                      <Copy className="h-4 w-4" />
                      Copiar código PIX
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Expira em {excursion.pix_expiration_minutes || 30} minutos</span>
                  </div>

                  <Separator />

                  <a
                    href={TAVARES_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      <Phone className="h-4 w-4" />
                      Dúvidas? Fale no WhatsApp
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right column: sticky summary (desktop only) */}
          <aside className="hidden lg:block w-[360px] shrink-0">
            <TripSummaryCard {...summaryProps} />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-5 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Tavares Transportes. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
