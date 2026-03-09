import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileText, Bus, Users, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  excursionId: string;
  excursion: any;
}

export function BoardingManifest({ excursionId, excursion }: Props) {
  const { data: orders = [] } = useQuery({
    queryKey: ["manifest-orders", excursionId],
    queryFn: async () => {
      const sb = supabase as any;
      const { data } = await sb
        .from("public_orders")
        .select("id,passenger_name,passenger_document,passenger_phone,passenger_email,passenger_address,seat_numbers,status,amount_paid_cents,payment_type")
        .eq("excursion_id", excursionId)
        .in("status", ["VENDIDO", "RESERVADO"])
        .order("seat_numbers", { ascending: true });
      return data || [];
    },
  });

  const { data: ticketSales = [] } = useQuery({
    queryKey: ["manifest-sales", excursionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_sales")
        .select("id,seat_numbers,amount_cents,payment_status,passengers(name,document,phone,email)")
        .eq("excursion_id", excursionId) as any;
      return data || [];
    },
  });

  // Merge passengers from both online orders and manual sales
  type PassengerRow = {
    name: string;
    document: string;
    phone: string;
    email: string;
    address: string;
    seats: number[];
    status: string;
    amount: number;
    source: string;
  };

  const passengers: PassengerRow[] = [];

  orders.forEach((o: any) => {
    passengers.push({
      name: o.passenger_name,
      document: o.passenger_document || "",
      phone: o.passenger_phone || "",
      email: o.passenger_email || "",
      address: o.passenger_address || "",
      seats: o.seat_numbers || [],
      status: o.status,
      amount: o.amount_paid_cents || 0,
      source: "Online",
    });
  });

  ticketSales.forEach((ts: any) => {
    const p = ts.passengers;
    if (!p) return;
    // Avoid duplicates by document
    const exists = passengers.find((px) => px.document && px.document === p.document);
    if (exists) return;
    passengers.push({
      name: p.name,
      document: p.document || "",
      phone: p.phone || "",
      email: p.email || "",
      address: "",
      seats: ts.seat_numbers || [],
      status: ts.payment_status === "PAGO" ? "VENDIDO" : "RESERVADO",
      amount: ts.amount_cents || 0,
      source: "Balcão",
    });
  });

  passengers.sort((a, b) => (a.seats[0] || 999) - (b.seats[0] || 999));

  const totalPaid = passengers.filter((p) => p.status === "VENDIDO").length;
  const totalReserved = passengers.filter((p) => p.status === "RESERVADO").length;
  const totalSeats = passengers.reduce((s, p) => s + p.seats.length, 0);

  const handlePrint = () => window.print();

  const depDate = excursion ? new Date(excursion.departure_at) : null;

  return (
    <Card className="print:shadow-none print:border-none">
      <CardHeader className="pb-3 print:pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Manifesto de Embarque
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:mb-2">
          <div className="p-3 rounded-lg bg-muted/50 print:bg-transparent print:border print:p-2">
            <p className="text-[11px] text-muted-foreground">Excursão</p>
            <p className="font-semibold text-sm">{excursion?.name || "–"}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 print:bg-transparent print:border print:p-2">
            <p className="text-[11px] text-muted-foreground">Destino</p>
            <p className="font-semibold text-sm">{excursion?.destination || "–"}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 print:bg-transparent print:border print:p-2">
            <p className="text-[11px] text-muted-foreground">Saída</p>
            <p className="font-semibold text-sm">
              {depDate ? depDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "–"}
              {depDate && <span className="text-muted-foreground ml-1">{depDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 print:bg-transparent print:border print:p-2">
            <p className="text-[11px] text-muted-foreground">Passageiros</p>
            <p className="font-semibold text-sm">
              {totalSeats} assentos
              <span className="text-muted-foreground text-xs ml-1">({totalPaid} pagos, {totalReserved} reservados)</span>
            </p>
          </div>
        </div>

        {/* Passenger table */}
        {passengers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Nenhum passageiro registrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Assento</TableHead>
                  <TableHead>Passageiro</TableHead>
                  <TableHead className="print:hidden">Documento</TableHead>
                  <TableHead className="print:hidden">Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="print:hidden">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((p, i) => (
                  <TableRow key={i} className="print:text-xs">
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono font-bold text-sm">{p.seats.join(", ")}</TableCell>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground print:hidden">{p.document || "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground print:hidden">{p.phone || "–"}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "VENDIDO" ? "default" : "secondary"} className="text-[10px]">
                        {p.status === "VENDIDO" ? "Pago" : "Reservado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground print:hidden">{p.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Print footer */}
        <div className="hidden print:block mt-6 pt-4 border-t text-xs text-muted-foreground">
          <p>Documento gerado em {new Date().toLocaleString("pt-BR")} — Tavares Transportes</p>
        </div>
      </CardContent>
    </Card>
  );
}
