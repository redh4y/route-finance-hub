import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  useExcursion,
  useExcursionSeats,
  useTicketSales,
  useSellTicket,
  useUpdateExcursion,
} from "@/hooks/useExcursions";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Bus,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Lock,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_VENDA: "Em Venda",
  LOTADA: "Lotada",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

const seatColors: Record<string, string> = {
  DISPONIVEL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer",
  RESERVADO: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  VENDIDO: "bg-primary/20 text-primary border-primary/40",
  CANCELADO: "bg-muted text-muted-foreground border-muted",
  BLOQUEADO: "bg-destructive/20 text-destructive border-destructive/40",
};

export default function ExcursionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: excursion, isLoading } = useExcursion(id);
  const { data: seats } = useExcursionSeats(id);
  const { data: sales } = useTicketSales(id);
  const sellTicket = useSellTicket();
  const updateExcursion = useUpdateExcursion();

  const [sellOpen, setSellOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [passengerName, setPassengerName] = useState("");
  const [passengerDoc, setPassengerDoc] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [installments, setInstallments] = useState("1");

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      </MainLayout>
    );
  }

  if (!excursion) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">Excursão não encontrada</div>
      </MainLayout>
    );
  }

  const soldSeats = (seats || []).filter((s) => s.status === "VENDIDO").length;
  const availableSeats = (seats || []).filter((s) => s.status === "DISPONIVEL" && !s.blocked).length;
  const occupancy = excursion.total_seats > 0 ? Math.round((soldSeats / excursion.total_seats) * 100) : 0;
  const totalRevenue = (sales || []).reduce((sum, s) => sum + s.amount_cents, 0);

  const toggleSeat = (seatNumber: number) => {
    const seat = seats?.find((s) => s.seat_number === seatNumber);
    if (!seat || seat.status !== "DISPONIVEL" || seat.blocked) return;
    setSelectedSeats((prev) =>
      prev.includes(seatNumber)
        ? prev.filter((n) => n !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  const handleSell = () => {
    if (!passengerName || selectedSeats.length === 0) {
      toast.error("Informe o passageiro e selecione ao menos um assento");
      return;
    }
    const amount = selectedSeats.length * excursion.seat_price_cents;
    sellTicket.mutate(
      {
        excursion_id: excursion.id,
        passenger: {
          name: passengerName,
          document: passengerDoc || undefined,
          phone: passengerPhone || undefined,
          email: passengerEmail || undefined,
        },
        seat_numbers: selectedSeats,
        amount_cents: amount,
        payment_method: paymentMethod,
        installments: parseInt(installments) || 1,
      },
      {
        onSuccess: () => {
          setSellOpen(false);
          setSelectedSeats([]);
          setPassengerName("");
          setPassengerDoc("");
          setPassengerPhone("");
          setPassengerEmail("");
        },
      }
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateExcursion.mutate({ id: excursion.id, status: newStatus } as any);
  };

  // Build seat grid (rows of seats like a bus: 2+2 layout)
  const seatRows: number[][] = [];
  const totalS = seats?.length || excursion.total_seats;
  for (let i = 0; i < totalS; i += 4) {
    const row: number[] = [];
    for (let j = 0; j < 4 && i + j < totalS; j++) {
      row.push(i + j + 1);
    }
    seatRows.push(row);
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/excursoes")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="page-title">{excursion.name}</h1>
              <p className="page-subtitle flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {excursion.destination}
                {excursion.destination_state ? `/${excursion.destination_state}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={excursion.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                <SelectItem value="EM_VENDA">Em Venda</SelectItem>
                <SelectItem value="LOTADA">Lotada</SelectItem>
                <SelectItem value="FINALIZADA">Finalizada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setSellOpen(true)} disabled={excursion.status === "CANCELADA" || excursion.status === "FINALIZADA"}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Vender
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Ocupação</p>
                <p className="text-xl font-bold">{occupancy}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground">Vendidos</p>
                <p className="text-xl font-bold">{soldSeats}/{excursion.total_seats}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
                <p className="text-xl font-bold">{availableSeats}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Seat Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5" />
              Mapa de Assentos
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
                <span className="w-3 h-3 rounded bg-primary/30 border border-primary/50" />
                Vendido
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/50" />
                Reservado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-destructive/30 border border-destructive/50" />
                Bloqueado
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
                        <>
                          <button
                            key={sn}
                            onClick={() => toggleSeat(sn)}
                            className={cn(
                              "w-10 h-10 rounded border text-xs font-medium transition-all",
                              isSelected
                                ? "bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/50"
                                : seatColors[status] || seatColors.DISPONIVEL
                            )}
                            disabled={status !== "DISPONIVEL"}
                          >
                            {sn}
                          </button>
                          {ci === 1 && <div className="w-4" />}
                        </>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedSeats.length > 0 && (
              <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm">
                  <strong>{selectedSeats.length}</strong> assento(s) selecionado(s):{" "}
                  {selectedSeats.sort((a, b) => a - b).join(", ")}
                </p>
                <p className="text-sm font-medium mt-1">
                  Total: {formatCurrency(selectedSeats.length * excursion.seat_price_cents)}
                </p>
                <Button size="sm" className="mt-2" onClick={() => setSellOpen(true)}>
                  Vender selecionados
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas ({sales?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!sales || sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma venda ainda
              </p>
            ) : (
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Passageiro</TableHead>
                      <TableHead>Assentos</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{sale.passengers?.name}</p>
                            {sale.passengers?.document && (
                              <p className="text-xs text-muted-foreground">{sale.passengers.document}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.seat_numbers.join(", ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {sale.payment_method}
                          </Badge>
                          <br />
                          <Badge
                            variant={sale.payment_status === "PAGO" ? "secondary" : "outline"}
                            className="text-xs mt-1"
                          >
                            {sale.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(sale.amount_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground">Saída</p>
              <p className="font-medium">
                {new Date(excursion.departure_at).toLocaleString("pt-BR")}
              </p>
            </div>
            {excursion.return_at && (
              <div>
                <p className="text-muted-foreground">Retorno</p>
                <p className="font-medium">
                  {new Date(excursion.return_at).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
            {excursion.boarding_location && (
              <div>
                <p className="text-muted-foreground">Local embarque</p>
                <p className="font-medium">{excursion.boarding_location}</p>
              </div>
            )}
            {excursion.vehicles?.name && (
              <div>
                <p className="text-muted-foreground">Veículo</p>
                <p className="font-medium">{excursion.vehicles.name}</p>
              </div>
            )}
            {excursion.notes && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Observações</p>
                <p className="font-medium">{excursion.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sell Dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Venda de Assento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do passageiro *</Label>
              <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={passengerDoc} onChange={(e) => setPassengerDoc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assentos selecionados</Label>
              <p className="text-sm font-medium">
                {selectedSeats.length > 0
                  ? selectedSeats.sort((a, b) => a - b).join(", ")
                  : "Nenhum assento selecionado"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={installments} onValueChange={setInstallments}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Total: {formatCurrency(selectedSeats.length * excursion.seat_price_cents)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSell}
              disabled={!passengerName || selectedSeats.length === 0 || sellTicket.isPending}
            >
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
