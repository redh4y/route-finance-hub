import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExcursion } from "@/hooks/useExcursions";
import { useDrivers } from "@/hooks/useDrivers";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, MapPin, Calendar, Bus, Ticket, FileText,
  Clock, Users, DollarSign, TrendingUp, Armchair, AlertCircle,
  CheckCircle2, ChevronRight, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const STEP_KEYS = ["info", "dates", "vehicle", "pricing"] as const;
type StepKey = typeof STEP_KEYS[number];

interface StepDef {
  key: StepKey;
  title: string;
  shortTitle: string;
  icon: typeof FileText;
  isValid: () => boolean;
}

export default function ExcursionForm() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const createExcursion = useCreateExcursion();
  const { driversQuery } = useDrivers();
  const drivers = driversQuery?.data?.filter(d => d.status === "ATIVO") || [];

  const [activeStep, setActiveStep] = useState<StepKey>("info");

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationState, setDestinationState] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("06:00");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("18:00");
  const [boardingLocation, setBoardingLocation] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [totalSeats, setTotalSeats] = useState("46");
  const [seatPrice, setSeatPrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; plate: string | null }[];
    },
  });

  const priceCents = Math.round(parseFloat(seatPrice.replace(",", ".") || "0") * 100);
  const seatsNum = parseInt(totalSeats) || 0;
  const potentialRevenue = (parseFloat(seatPrice.replace(",", ".") || "0") * seatsNum);

  const steps: StepDef[] = useMemo(() => [
    {
      key: "info",
      title: "Informações Básicas",
      shortTitle: "Info",
      icon: FileText,
      isValid: () => !!name.trim() && !!destination.trim(),
    },
    {
      key: "dates",
      title: "Datas e Horários",
      shortTitle: "Datas",
      icon: Calendar,
      isValid: () => !!departureDate,
    },
    {
      key: "vehicle",
      title: "Embarque e Veículo",
      shortTitle: "Veículo",
      icon: Bus,
      isValid: () => true,
    },
    {
      key: "pricing",
      title: "Assentos e Preço",
      shortTitle: "Preço",
      icon: Ticket,
      isValid: () => seatsNum > 0 && priceCents > 0,
    },
  ], [name, destination, departureDate, seatsNum, priceCents]);

  const currentStepIdx = STEP_KEYS.indexOf(activeStep);
  const allValid = steps.every(s => s.isValid());
  const canSubmit = allValid && !createExcursion.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createExcursion.mutate(
      {
        name,
        destination,
        destination_state: destinationState || undefined,
        departure_at: `${departureDate}T${departureTime}:00`,
        return_at: returnDate ? `${returnDate}T${returnTime}:00` : undefined,
        boarding_location: boardingLocation || undefined,
        vehicle_id: vehicleId || undefined,
        drivers: selectedDrivers.length > 0 ? selectedDrivers : undefined,
        total_seats: seatsNum || 46,
        seat_price_cents: priceCents,
        notes: notes || undefined,
      },
      { onSuccess: () => navigate("/excursoes") }
    );
  };

  const goNext = () => {
    const idx = STEP_KEYS.indexOf(activeStep);
    if (idx < STEP_KEYS.length - 1) setActiveStep(STEP_KEYS[idx + 1]);
  };
  const goPrev = () => {
    const idx = STEP_KEYS.indexOf(activeStep);
    if (idx > 0) setActiveStep(STEP_KEYS[idx - 1]);
  };

  const toggleDriver = (id: string) => {
    setSelectedDrivers(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  // Duration calculation
  const duration = useMemo(() => {
    if (!departureDate || !returnDate) return null;
    const dep = new Date(`${departureDate}T${departureTime}:00`);
    const ret = new Date(`${returnDate}T${returnTime}:00`);
    const diffMs = ret.getTime() - dep.getTime();
    if (diffMs <= 0) return null;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days === 0) return `${hours}h`;
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }, [departureDate, departureTime, returnDate, returnTime]);

  return (
    <MainLayout>
      <PageTransition>
        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border mb-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/excursoes")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nova Excursão</h1>
                <p className="text-sm text-muted-foreground">Preencha os dados para criar a viagem</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* ── Step Navigation ── */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 scrollbar-none">
            {steps.map((step, i) => {
              const isActive = activeStep === step.key;
              const isComplete = step.isValid() && !isActive;
              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <button
                    onClick={() => setActiveStep(step.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isComplete
                          ? "text-emerald-600 dark:text-emerald-400 hover:bg-muted/50"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {isComplete && !isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <step.icon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.title}</span>
                    <span className="sm:hidden">{step.shortTitle}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step Content ── */}
          <AnimatePresence mode="wait">
            {/* Step: Info */}
            {activeStep === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-primary" />
                      Informações Básicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da excursão <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Excursão Gramado Natal Luz 2026"
                        className="h-11"
                      />
                      <p className="text-[11px] text-muted-foreground">Nome visível para a equipe e no link público</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="dest">Destino <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="dest"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="Cidade de destino"
                            className="pl-9 h-11"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>UF</Label>
                        <Select value={destinationState} onValueChange={setDestinationState}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="UF" /></SelectTrigger>
                          <SelectContent>
                            {UF_LIST.map((uf) => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {name && destination && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{name}</strong> → {destination}{destinationState ? `/${destinationState}` : ""}
                        </span>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step: Dates */}
            {activeStep === "dates" && (
              <motion.div key="dates" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4 text-primary" />
                      Datas e Horários
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Saída</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="dep-date">Data <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input id="dep-date" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="pl-9 h-11" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dep-time">Horário</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input id="dep-time" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="pl-9 h-11" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Retorno</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="ret-date">Data</Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input id="ret-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="pl-9 h-11" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ret-time">Horário</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input id="ret-time" type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="pl-9 h-11" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {duration && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm"
                      >
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">
                          Duração estimada: <strong className="text-foreground">{duration}</strong>
                        </span>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step: Vehicle */}
            {activeStep === "vehicle" && (
              <motion.div key="vehicle" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bus className="h-4 w-4 text-primary" />
                      Embarque e Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="boarding">Local de embarque</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="boarding"
                          value={boardingLocation}
                          onChange={(e) => setBoardingLocation(e.target.value)}
                          placeholder="Endereço ou ponto de referência"
                          className="pl-9 h-11"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Veículo</Label>
                      <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                        <SelectContent>
                          {vehicles?.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              <span className="flex items-center gap-2">
                                <Bus className="h-3.5 w-3.5 text-muted-foreground" />
                                {v.name} {v.plate ? <Badge variant="outline" className="text-[10px] ml-1">{v.plate}</Badge> : ""}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!vehicles?.length && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Info className="h-3 w-3" /> Nenhum veículo ativo cadastrado
                        </p>
                      )}
                    </div>

                    {drivers.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <Label>Motoristas</Label>
                          <div className="flex flex-wrap gap-2">
                            {drivers.map(d => {
                              const selected = selectedDrivers.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => toggleDriver(d.id)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                                  )}
                                >
                                  {d.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step: Pricing */}
            {activeStep === "pricing" && (
              <motion.div key="pricing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.15 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Ticket className="h-4 w-4 text-primary" />
                      Assentos e Preço
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="seats">Total de assentos <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <Armchair className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="seats" type="number" value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} className="pl-9 h-11" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço por assento <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="price" value={seatPrice} onChange={(e) => setSeatPrice(e.target.value)} placeholder="0,00" className="pl-9 h-11" />
                        </div>
                      </div>
                    </div>

                    {seatsNum > 0 && priceCents > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-xl bg-muted/30 border text-center">
                            <Armchair className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-lg font-bold">{seatsNum}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Assentos</p>
                          </div>
                          <div className="p-3 rounded-xl bg-muted/30 border text-center">
                            <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-lg font-bold">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase">Por assento</p>
                          </div>
                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
                            <p className="text-lg font-bold text-primary">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(potentialRevenue)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase">Receita potencial</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Informações adicionais sobre a excursão..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Navigation + Submit ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-6 mb-8"
          >
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentStepIdx === 0}
                className="h-11"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Anterior
              </Button>

              {currentStepIdx < STEP_KEYS.length - 1 ? (
                <Button onClick={goNext} className="h-11">
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="h-11 min-w-[180px]"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createExcursion.isPending ? "Criando..." : "Criar Excursão"}
                </Button>
              )}
            </div>

            {/* Validation summary on last step */}
            {activeStep === "pricing" && !allValid && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
              >
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Campos obrigatórios pendentes:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                  {!name.trim() && <li>• Nome da excursão</li>}
                  {!destination.trim() && <li>• Destino</li>}
                  {!departureDate && <li>• Data de saída</li>}
                  {seatsNum <= 0 && <li>• Total de assentos</li>}
                  {priceCents <= 0 && <li>• Preço por assento</li>}
                </ul>
              </motion.div>
            )}
          </motion.div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
