import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInspectionChecklists, DEFAULT_CHECKLIST_ITEMS, type ChecklistItem } from "@/hooks/useInspectionChecklists";
import { useDrivers } from "@/hooks/useDrivers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, Plus, Printer, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  OK: "bg-success/10 text-success border-success/20",
  AJUSTAR: "bg-warning/10 text-warning border-warning/20",
  CRITICO: "bg-destructive/10 text-destructive border-destructive/20",
  NA: "bg-muted text-muted-foreground border-border",
};

export default function InspectionChecklists() {
  const { checklists, isLoading, createChecklist } = useInspectionChecklists();
  const { drivers } = useDrivers();
  const [showCreate, setShowCreate] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>(JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_ITEMS)));
  const [observations, setObservations] = useState("");
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, name").eq("active", true).order("name");
      return data || [];
    },
  });

  const updateItem = (index: number, field: keyof ChecklistItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleCreate = () => {
    if (!vehicleId) return;
    createChecklist.mutate({ vehicle_id: vehicleId, driver_id: driverId || undefined, inspector_name: inspectorName || undefined, items, observations: observations || undefined }, {
      onSuccess: () => {
        setShowCreate(false);
        setVehicleId(""); setDriverId(""); setInspectorName("");
        setItems(JSON.parse(JSON.stringify(DEFAULT_CHECKLIST_ITEMS)));
        setObservations("");
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const detailChecklist = checklists.find(c => c.id === showDetail);
  const groups = [...new Set(items.map(i => i.group))];

  return (
    <MainLayout>
      <PageTransition>
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">Checklist de Inspeção</h1>
            <p className="page-subtitle">Inspeção diária dos veículos da frota</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Inspeção
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : checklists.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">Nenhuma inspeção realizada</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {checklists.map(c => {
              const criticalCount = c.items.filter(i => i.status === "CRITICO").length;
              const adjustCount = c.items.filter(i => i.status === "AJUSTAR").length;
              return (
                <Card key={c.id} className={criticalCount > 0 ? "border-destructive/30 cursor-pointer" : "cursor-pointer"} onClick={() => setShowDetail(c.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{c.vehicle_name}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>📅 {format(new Date(c.inspection_date), "dd/MM/yyyy")}</span>
                          {c.inspector_name && <span>👤 {c.inspector_name}</span>}
                          {c.driver_name && <span>🚌 {c.driver_name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {criticalCount > 0 && <Badge className="bg-destructive/10 text-destructive border-destructive/20">{criticalCount} Crítico</Badge>}
                        {adjustCount > 0 && <Badge className="bg-warning/10 text-warning border-warning/20">{adjustCount} Ajustar</Badge>}
                        {criticalCount === 0 && adjustCount === 0 && <Badge className="bg-success/10 text-success border-success/20">OK</Badge>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Inspeção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Veículo *</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{vehicles?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <Select value={driverId} onValueChange={setDriverId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={inspectorName} onChange={e => setInspectorName(e.target.value)} placeholder="Nome" />
                </div>
              </div>

              {groups.map(group => (
                <div key={group}>
                  <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wider">{group}</h3>
                  <div className="space-y-2">
                    {items.map((item, idx) => item.group !== group ? null : (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg border">
                        <p className="text-sm flex-1 min-w-0">{item.label}</p>
                        <div className="flex gap-1 shrink-0">
                          {(["OK", "AJUSTAR", "CRITICO"] as const).map(s => (
                            <Button
                              key={s}
                              size="sm"
                              variant={item.status === s ? "default" : "outline"}
                              className={`h-7 text-xs px-2 ${item.status === s ? statusColors[s] : ""}`}
                              onClick={() => updateItem(idx, "status", s)}
                            >
                              {s === "OK" ? <CheckCircle2 className="h-3 w-3" /> : s === "AJUSTAR" ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            </Button>
                          ))}
                        </div>
                        {(item.status === "AJUSTAR" || item.status === "CRITICO") && (
                          <Input
                            className="h-7 text-xs"
                            placeholder="Observação"
                            value={item.observation}
                            onChange={e => updateItem(idx, "observation", e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <Label>Observações gerais</Label>
                <Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createChecklist.isPending || !vehicleId}>Salvar Inspeção</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail/Print Dialog */}
        <Dialog open={!!showDetail} onOpenChange={(o) => !o && setShowDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Inspeção - {detailChecklist?.vehicle_name}</span>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
              </DialogTitle>
            </DialogHeader>
            {detailChecklist && (
              <div ref={printRef} className="space-y-4 print:p-8">
                <div className="print:block">
                  <h2 className="text-lg font-bold print:text-xl">CHECKLIST DIÁRIO – {detailChecklist.vehicle_name}</h2>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>Data: {format(new Date(detailChecklist.inspection_date), "dd/MM/yyyy")}</span>
                    {detailChecklist.inspector_name && <span>Responsável: {detailChecklist.inspector_name}</span>}
                    {detailChecklist.driver_name && <span>Motorista: {detailChecklist.driver_name}</span>}
                  </div>
                </div>
                {[...new Set(detailChecklist.items.map(i => i.group))].map(group => (
                  <div key={group}>
                    <h3 className="font-semibold text-sm mb-2 uppercase tracking-wider">{group}</h3>
                    <div className="space-y-1">
                      {detailChecklist.items.filter(i => i.group === group).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-border/50">
                          <Badge className={`text-xs ${statusColors[item.status]}`}>{item.status}</Badge>
                          <span className="flex-1">{item.label}</span>
                          {item.observation && <span className="text-xs text-muted-foreground italic">{item.observation}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {detailChecklist.observations && (
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Observações</h3>
                    <p className="text-sm">{detailChecklist.observations}</p>
                  </div>
                )}
                <div className="print:block hidden mt-8 border-t pt-4">
                  <p className="text-sm">Assinatura: ________________________</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
