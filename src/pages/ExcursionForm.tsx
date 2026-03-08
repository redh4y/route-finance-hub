import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateExcursion } from "@/hooks/useExcursions";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, MapPin, Calendar, Bus, Ticket, FileText } from "lucide-react";
import { motion } from "framer-motion";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export default function ExcursionForm() {
  const navigate = useNavigate();
  const createExcursion = useCreateExcursion();

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationState, setDestinationState] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("06:00");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("18:00");
  const [boardingLocation, setBoardingLocation] = useState("");
  const [vehicleId, setVehicleId] = useState("");
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

  const handleSubmit = () => {
    if (!name || !destination || !departureDate) return;
    const priceCents = Math.round(parseFloat(seatPrice.replace(",", ".") || "0") * 100);
    createExcursion.mutate(
      {
        name,
        destination,
        destination_state: destinationState || undefined,
        departure_at: `${departureDate}T${departureTime}:00`,
        return_at: returnDate ? `${returnDate}T${returnTime}:00` : undefined,
        boarding_location: boardingLocation || undefined,
        vehicle_id: vehicleId || undefined,
        total_seats: parseInt(totalSeats) || 46,
        seat_price_cents: priceCents,
        notes: notes || undefined,
      },
      { onSuccess: () => navigate("/excursoes") }
    );
  };

  const sections = [
    {
      title: "Informações Básicas",
      icon: FileText,
      content: (
        <>
          <div className="space-y-2">
            <Label>Nome da excursão *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Excursão Gramado Natal Luz" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
            <div className="space-y-2">
              <Label>Destino *</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Cidade de destino" />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Select value={destinationState} onValueChange={setDestinationState}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ),
    },
    {
      title: "Datas e Horários",
      icon: Calendar,
      content: (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data saída *</Label>
              <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora saída</Label>
              <Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data retorno</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora retorno</Label>
              <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
            </div>
          </div>
        </>
      ),
    },
    {
      title: "Embarque e Veículo",
      icon: Bus,
      content: (
        <>
          <div className="space-y-2">
            <Label>Local de embarque/desembarque</Label>
            <Input value={boardingLocation} onChange={(e) => setBoardingLocation(e.target.value)} placeholder="Endereço ou ponto de referência" />
          </div>
          <div className="space-y-2">
            <Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} {v.plate ? `(${v.plate})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ),
    },
    {
      title: "Assentos e Preço",
      icon: Ticket,
      content: (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Total de assentos *</Label>
              <Input type="number" value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preço por assento (R$) *</Label>
              <Input value={seatPrice} onChange={(e) => setSeatPrice(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          {seatPrice && totalSeats && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-sm text-muted-foreground">Receita potencial:</p>
              <p className="text-lg font-bold text-success">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  (parseFloat(seatPrice.replace(",", ".") || "0") * (parseInt(totalSeats) || 0))
                )}
              </p>
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/excursoes")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="page-title">Nova Excursão</h1>
              <p className="page-subtitle">Preencha os dados da viagem</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {sections.map((section, i) => (
            <motion.div key={section.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <section.icon className="h-4 w-4 text-muted-foreground" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section.content}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Notes */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais sobre a excursão..." rows={3} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Submit */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Button
              className="w-full h-12 text-base"
              onClick={handleSubmit}
              disabled={!name || !destination || !departureDate || createExcursion.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {createExcursion.isPending ? "Criando..." : "Criar Excursão"}
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
