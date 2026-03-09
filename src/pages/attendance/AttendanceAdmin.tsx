import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAttendanceMonitor, useStudents, useTransportBuses, useTransportRoutes, useTodayTrips } from "@/hooks/useAttendance";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MainLayout } from "@/components/layout/MainLayout";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Users, Bus, MapPin, Calendar, BarChart3, Settings, Plus, Edit, Trash2,
  CheckCircle2, Clock, ArrowRight, ArrowLeft, Eye, Download, RefreshCw
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

// ─── Dashboard Tab ──────────────────────────────────────────────
function DashboardTab() {
  const { data: monitor } = useAttendanceMonitor();
  const { data: students } = useStudents();
  const { data: trips } = useTodayTrips();

  const totalStudents = students?.filter((s: any) => s.active).length || 0;
  const outboundCount = monitor?.filter((a: any) => a.trip_type === "OUTBOUND" && a.status === "confirmed").length || 0;
  const returnCount = monitor?.filter((a: any) => a.trip_type === "RETURN" && a.status === "confirmed").length || 0;

  // Group by bus
  const byBus: Record<string, { name: string; count: number }> = {};
  monitor?.forEach((a: any) => {
    const busName = a.transport_buses?.name || "Sem ônibus";
    if (!byBus[busName]) byBus[busName] = { name: busName, count: 0 };
    byBus[busName].count++;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalStudents}</p>
          <p className="text-xs text-muted-foreground">Alunos ativos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{outboundCount}</p>
          <p className="text-xs text-muted-foreground">Presenças ida</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">{returnCount}</p>
          <p className="text-xs text-muted-foreground">Presenças volta</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{totalStudents - outboundCount}</p>
          <p className="text-xs text-muted-foreground">Pendentes ida</p>
        </CardContent></Card>
      </div>

      {/* By bus */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Presenças por ônibus</CardTitle></CardHeader>
        <CardContent>
          {Object.values(byBus).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma presença registrada hoje.</p>
          ) : (
            <div className="space-y-2">
              {Object.values(byBus).map((b) => (
                <div key={b.name} className="flex justify-between items-center p-2 rounded bg-muted">
                  <span className="text-sm font-medium flex items-center gap-2"><Bus className="h-4 w-4" /> {b.name}</span>
                  <Badge>{b.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent check-ins */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Últimos check-ins</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {monitor?.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex justify-between items-center text-sm p-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{a.students?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{a.transport_buses?.name} · {a.trip_type === "OUTBOUND" ? "Ida" : "Volta"}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.check_in_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {(!monitor || monitor.length === 0) && <p className="text-sm text-muted-foreground">Sem check-ins hoje.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Students Tab ──────────────────────────────────────────────
function StudentsTab() {
  const qc = useQueryClient();
  const { data: students, isLoading } = useStudents();
  const { data: routes } = useTransportRoutes();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", registration: "", course: "", default_route_id: "" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, registration: form.registration, course: form.course || null, default_route_id: form.default_route_id || null };
      if (editId) {
        const { error } = await supabase.from("students" as any).update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["students"] }); setShowForm(false); setEditId(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = async (id: string) => {
    if (!confirm("Remover aluno?")) return;
    await supabase.from("students" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, registration: s.registration, course: s.course || "", default_route_id: s.default_route_id || "" });
    setEditId(s.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Alunos</h3>
        <Button size="sm" onClick={() => { setForm({ name: "", registration: "", course: "", default_route_id: "" }); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Aluno</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Matrícula</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></div>
            <div><Label>Curso</Label><Input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></div>
            <div>
              <Label>Rota padrão</Label>
              <Select value={form.default_route_id} onValueChange={(v) => setForm({ ...form, default_route_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {routes?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.registration}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>Matrícula</TableHead><TableHead>Curso</TableHead><TableHead>Rota</TableHead><TableHead className="w-20">Ações</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {students?.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.registration}</TableCell>
                <TableCell>{s.course || "—"}</TableCell>
                <TableCell>{s.transport_routes?.name || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Buses Tab ──────────────────────────────────────────────
function BusesTab() {
  const qc = useQueryClient();
  const { data: buses } = useTransportBuses();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", plate: "", identifier_code: "", notes: "" });
  const [showQr, setShowQr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, plate: form.plate || null, identifier_code: form.identifier_code, notes: form.notes || null };
      if (editId) {
        const { error } = await supabase.from("transport_buses" as any).update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transport_buses" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport-buses"] }); setShowForm(false); setEditId(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = async (id: string) => {
    if (!confirm("Remover ônibus?")) return;
    await supabase.from("transport_buses" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["transport-buses"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Ônibus</h3>
        <Button size="sm" onClick={() => { setForm({ name: "", plate: "", identifier_code: "", notes: "" }); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Ônibus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Ônibus 01" /></div>
            <div><Label>Placa</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="ABC-1234" /></div>
            <div><Label>Código identificador</Label><Input value={form.identifier_code} onChange={(e) => setForm({ ...form, identifier_code: e.target.value })} placeholder="BUS-01" /></div>
            <div><Label>Observações</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.identifier_code}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code viewer */}
      <Dialog open={!!showQr} onOpenChange={() => setShowQr(null)}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader><DialogTitle>QR Code do Ônibus</DialogTitle></DialogHeader>
          {showQr && (
            <div className="flex flex-col items-center gap-4">
              <QRCodeSVG value={showQr} size={200} />
              <p className="text-xs text-muted-foreground">Imprima e cole no ônibus</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>Placa</TableHead><TableHead>Código</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {buses?.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.plate || "—"}</TableCell>
                <TableCell><Badge variant="outline">{b.identifier_code}</Badge></TableCell>
                <TableCell><Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setShowQr(b.qr_code_value)} title="Ver QR"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ name: b.name, plate: b.plate || "", identifier_code: b.identifier_code, notes: b.notes || "" }); setEditId(b.id); setShowForm(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Routes Tab ──────────────────────────────────────────────
function RoutesTab() {
  const qc = useQueryClient();
  const { data: routes } = useTransportRoutes();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", boarding_location_name: "", boarding_latitude: "", boarding_longitude: "", radius_meters: "50" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        boarding_location_name: form.boarding_location_name || null,
        boarding_latitude: form.boarding_latitude ? parseFloat(form.boarding_latitude) : null,
        boarding_longitude: form.boarding_longitude ? parseFloat(form.boarding_longitude) : null,
        radius_meters: parseInt(form.radius_meters) || 50,
      };
      if (editId) {
        const { error } = await supabase.from("transport_routes" as any).update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transport_routes" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport-routes"] }); setShowForm(false); setEditId(null); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Rotas</h3>
        <Button size="sm" onClick={() => { setForm({ name: "", description: "", boarding_location_name: "", boarding_latitude: "", boarding_longitude: "", radius_meters: "50" }); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Rota</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Guaíra → Franca" /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Local de embarque</Label><Input value={form.boarding_location_name} onChange={(e) => setForm({ ...form, boarding_location_name: e.target.value })} placeholder="Praça Central" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.boarding_latitude} onChange={(e) => setForm({ ...form, boarding_latitude: e.target.value })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.boarding_longitude} onChange={(e) => setForm({ ...form, boarding_longitude: e.target.value })} /></div>
            </div>
            <div><Label>Raio de presença (metros)</Label><Input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} /></div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>Local</TableHead><TableHead>Raio</TableHead><TableHead>Coordenadas</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {routes?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.boarding_location_name || "—"}</TableCell>
                <TableCell>{r.radius_meters}m</TableCell>
                <TableCell className="text-xs">{r.boarding_latitude && r.boarding_longitude ? `${r.boarding_latitude.toFixed(4)}, ${r.boarding_longitude.toFixed(4)}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Trips Tab ──────────────────────────────────────────────
function TripsTab() {
  const qc = useQueryClient();
  const { data: routes } = useTransportRoutes();
  const { data: buses } = useTransportBuses();
  const [selectedDate, setSelectedDate] = useState(today());
  const { data: trips } = useQuery({
    queryKey: ["trips-admin", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips" as any).select("*, transport_routes(*), bus_assignments(*, transport_buses(*))").eq("date", selectedDate).order("boarding_start_time");
      if (error) throw error;
      return data;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ trip_type: "OUTBOUND", route_id: "", boarding_start_time: "06:00", boarding_end_time: "08:00", bus_ids: [] as string[] });

  const save = useMutation({
    mutationFn: async () => {
      if (editId) {
        // Update existing trip
        const { error } = await supabase.from("trips" as any).update({
          boarding_start_time: form.boarding_start_time,
          boarding_end_time: form.boarding_end_time,
          trip_type: form.trip_type,
          route_id: form.route_id,
        } as any).eq("id", editId);
        if (error) throw error;

        // Sync bus assignments: remove old, add new
        await supabase.from("bus_assignments" as any).delete().eq("trip_id", editId);
        if (form.bus_ids.length > 0) {
          await supabase.from("bus_assignments" as any).insert(
            form.bus_ids.map((bid) => ({ trip_id: editId, bus_id: bid })) as any
          );
        }
      } else {
        const { data: trip, error } = await supabase.from("trips" as any).insert({
          date: selectedDate,
          trip_type: form.trip_type,
          route_id: form.route_id,
          boarding_start_time: form.boarding_start_time,
          boarding_end_time: form.boarding_end_time,
        } as any).select().single();
        if (error) throw error;
        if (form.bus_ids.length > 0 && trip) {
          await supabase.from("bus_assignments" as any).insert(
            form.bus_ids.map((bid) => ({ trip_id: (trip as any).id, bus_id: bid })) as any
          );
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips-admin"] }); setShowForm(false); setEditId(null); toast.success(editId ? "Viagem atualizada!" : "Viagem criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTrip = async (id: string) => {
    if (!confirm("Remover viagem?")) return;
    await supabase.from("bus_assignments" as any).delete().eq("trip_id", id);
    await supabase.from("trips" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["trips-admin"] });
    toast.success("Viagem removida!");
  };

  const openEdit = (t: any) => {
    setForm({
      trip_type: t.trip_type,
      route_id: t.route_id,
      boarding_start_time: t.boarding_start_time?.slice(0, 5) || "06:00",
      boarding_end_time: t.boarding_end_time?.slice(0, 5) || "08:00",
      bus_ids: t.bus_assignments?.map((ba: any) => ba.bus_id) || [],
    });
    setEditId(t.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Viagens</h3>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
        </div>
        <Button size="sm" onClick={() => { setForm({ trip_type: "OUTBOUND", route_id: routes?.[0]?.id || "", boarding_start_time: "06:00", boarding_end_time: "08:00", bus_ids: [] }); setEditId(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Viagem - {selectedDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Ida</SelectItem>
                  <SelectItem value="RETURN">Volta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rota</Label>
              <Select value={form.route_id} onValueChange={(v) => setForm({ ...form, route_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{routes?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início embarque</Label><Input type="time" value={form.boarding_start_time} onChange={(e) => setForm({ ...form, boarding_start_time: e.target.value })} /></div>
              <div><Label>Fim embarque</Label><Input type="time" value={form.boarding_end_time} onChange={(e) => setForm({ ...form, boarding_end_time: e.target.value })} /></div>
            </div>
            <div>
              <Label>Ônibus</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {buses?.filter((b: any) => b.active).map((b: any) => (
                  <Button
                    key={b.id}
                    variant={form.bus_ids.includes(b.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm({ ...form, bus_ids: form.bus_ids.includes(b.id) ? form.bus_ids.filter((x) => x !== b.id) : [...form.bus_ids, b.id] })}
                  >
                    {b.name}
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || !form.route_id}>
              {editId ? "Salvar alterações" : "Criar viagem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {(!trips || trips.length === 0) ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma viagem para {selectedDate}.</p>
      ) : (
        <div className="space-y-3">
          {(trips as any[]).map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.trip_type === "OUTBOUND" ? "default" : "secondary"}>
                        {t.trip_type === "OUTBOUND" ? <><ArrowRight className="h-3 w-3 mr-1" /> Ida</> : <><ArrowLeft className="h-3 w-3 mr-1" /> Volta</>}
                      </Badge>
                      <span className="text-sm font-medium">{t.transport_routes?.name || "—"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Embarque: {t.boarding_start_time?.slice(0, 5)} - {t.boarding_end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {t.bus_assignments?.map((ba: any) => (
                        <Badge key={ba.id} variant="outline" className="text-xs">
                          <Bus className="h-3 w-3 mr-1" /> {ba.transport_buses?.name}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeTrip(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────
function SettingsTab() {
  const qc = useQueryClient();
  const [outboundStart, setOutboundStart] = useState("06:00");
  const [outboundEnd, setOutboundEnd] = useState("07:00");
  const [returnStart, setReturnStart] = useState("17:00");
  const [returnEnd, setReturnEnd] = useState("18:00");
  const [loaded, setLoaded] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["attendance-settings", "default_trip_times"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_settings" as any)
        .select("*")
        .eq("key", "default_trip_times")
        .maybeSingle();
      return data;
    },
  });

  // Load saved settings
  if (settings && !loaded) {
    const v = (settings as any).value;
    if (v) {
      setOutboundStart(v.outbound_start || "06:00");
      setOutboundEnd(v.outbound_end || "07:00");
      setReturnStart(v.return_start || "17:00");
      setReturnEnd(v.return_end || "18:00");
    }
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = {
        outbound_start: outboundStart,
        outbound_end: outboundEnd,
        return_start: returnStart,
        return_end: returnEnd,
      };
      if (settings) {
        const { error } = await supabase.from("attendance_settings" as any)
          .update({ value } as any)
          .eq("key", "default_trip_times");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_settings" as any)
          .insert({ key: "default_trip_times", value } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-settings"] });
      toast.success("Horários padrão salvos!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Configurações de Viagens</h3>

      <Card>
        <CardHeader><CardTitle className="text-sm">Horários padrão (geração automática)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Estes horários são usados para gerar automaticamente as viagens de ida e volta nos dias úteis.
          </p>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <ArrowRight className="h-4 w-4" /> Viagem de Ida
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Início embarque</Label><Input type="time" value={outboundStart} onChange={(e) => setOutboundStart(e.target.value)} /></div>
                <div><Label className="text-xs">Fim embarque</Label><Input type="time" value={outboundEnd} onChange={(e) => setOutboundEnd(e.target.value)} /></div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <ArrowLeft className="h-4 w-4" /> Viagem de Volta
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Início embarque</Label><Input type="time" value={returnStart} onChange={(e) => setReturnStart(e.target.value)} /></div>
                <div><Label className="text-xs">Fim embarque</Label><Input type="time" value={returnEnd} onChange={(e) => setReturnEnd(e.target.value)} /></div>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Settings className="h-4 w-4 mr-2" /> Salvar horários padrão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Monitor Tab ──────────────────────────────────────────────
function MonitorTab() {
  const [date, setDate] = useState(today());
  const { data: monitor, isLoading } = useAttendanceMonitor(date);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Monitor de Presença</h3>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Viagem</TableHead>
              <TableHead>Ônibus</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monitor?.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.students?.name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{a.trip_type === "OUTBOUND" ? "Ida" : "Volta"}</Badge></TableCell>
                <TableCell>{a.transport_buses?.name || "—"}</TableCell>
                <TableCell className="text-xs">{new Date(a.check_in_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{a.method === "gps" ? "GPS" : a.method === "qr" ? "QR" : "Manual"}</Badge></TableCell>
                <TableCell><Badge variant={a.status === "confirmed" ? "default" : "secondary"} className="text-xs">{a.status === "confirmed" ? "Confirmada" : a.status}</Badge></TableCell>
              </TableRow>
            ))}
            {(!monitor || monitor.length === 0) && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma presença registrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────
export default function AttendanceAdmin() {
  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg"><CheckCircle2 className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold">Presença Universitário</h1>
            <p className="text-sm text-muted-foreground">Gestão do módulo de presença</p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto">
            <TabsTrigger value="dashboard" className="flex-1 min-w-fit"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="students" className="flex-1 min-w-fit"><Users className="h-4 w-4 mr-1" /> Alunos</TabsTrigger>
            <TabsTrigger value="buses" className="flex-1 min-w-fit"><Bus className="h-4 w-4 mr-1" /> Ônibus</TabsTrigger>
            <TabsTrigger value="routes" className="flex-1 min-w-fit"><MapPin className="h-4 w-4 mr-1" /> Rotas</TabsTrigger>
            <TabsTrigger value="trips" className="flex-1 min-w-fit"><Calendar className="h-4 w-4 mr-1" /> Viagens</TabsTrigger>
            <TabsTrigger value="monitor" className="flex-1 min-w-fit"><Eye className="h-4 w-4 mr-1" /> Monitor</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-fit"><Settings className="h-4 w-4 mr-1" /> Config</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="students"><StudentsTab /></TabsContent>
          <TabsContent value="buses"><BusesTab /></TabsContent>
          <TabsContent value="routes"><RoutesTab /></TabsContent>
          <TabsContent value="trips"><TripsTab /></TabsContent>
          <TabsContent value="monitor"><MonitorTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
