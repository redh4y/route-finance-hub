import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bus,
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Calendar,
  Hash,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type VehicleRecord = {
  id: string;
  name: string;
  plate: string | null;
  model: string | null;
  year: number | null;
  active: boolean;
  created_at: string;
};

const FILTER_OPTIONS = [
  { key: "all", label: "Todos", icon: Bus },
  { key: "active", label: "Ativos", icon: CheckCircle2 },
  { key: "inactive", label: "Inativos", icon: XCircle },
] as const;

type FilterKey = (typeof FILTER_OPTIONS)[number]["key"];

export default function Vehicles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleRecord | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [active, setActive] = useState(true);

  // Edit form
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editActive, setEditActive] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate, model, year, active, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as VehicleRecord[];
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!vehicles) return { total: 0, active: 0, inactive: 0 };
    return {
      total: vehicles.length,
      active: vehicles.filter((v) => v.active).length,
      inactive: vehicles.filter((v) => !v.active).length,
    };
  }, [vehicles]);

  // Filtered list
  const filtered = useMemo(() => {
    if (!vehicles) return [];
    let list = vehicles;
    if (filter === "active") list = list.filter((v) => v.active);
    if (filter === "inactive") list = list.filter((v) => !v.active);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.plate?.toLowerCase().includes(q) ||
          v.model?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, filter, searchTerm]);

  const filterCount = (key: FilterKey) => {
    switch (key) {
      case "all": return stats.total;
      case "active": return stats.active;
      case "inactive": return stats.inactive;
    }
  };

  const resetCreate = () => {
    setName(""); setPlate(""); setModel(""); setYear(""); setActive(true);
  };

  const createVehicle = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do veículo");
      const parsedYear = year ? Number.parseInt(year, 10) : null;
      const { error } = await supabase.from("vehicles").insert({
        name: name.trim(),
        plate: plate.trim() || null,
        model: model.trim() || null,
        year: Number.isNaN(parsedYear) ? null : parsedYear,
        active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo cadastrado com sucesso");
      resetCreate();
      setIsCreateOpen(false);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo excluído");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const updateVehicle = useMutation({
    mutationFn: async () => {
      if (!editingVehicle) return;
      const parsedYear = editYear ? Number.parseInt(editYear, 10) : null;
      const { error } = await supabase
        .from("vehicles")
        .update({
          name: editName.trim(),
          plate: editPlate.trim() || null,
          model: editModel.trim() || null,
          year: Number.isNaN(parsedYear) ? null : parsedYear,
          active: editActive,
        })
        .eq("id", editingVehicle.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo atualizado");
      setEditingVehicle(null);
    },
    onError: (error) => toast.error("Erro: " + error.message),
  });

  const openEdit = (vehicle: VehicleRecord) => {
    setEditingVehicle(vehicle);
    setEditName(vehicle.name);
    setEditPlate(vehicle.plate || "");
    setEditModel(vehicle.model || "");
    setEditYear(vehicle.year?.toString() || "");
    setEditActive(vehicle.active);
  };

  return (
    <MainLayout>
      <PageTransition>
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Veículos</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Gerencie a frota e vincule gastos por veículo
              </p>
            </div>
            <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo veículo
            </Button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {FILTER_OPTIONS.map((opt) => {
              const count = filterCount(opt.key);
              const isSelected = filter === opt.key;
              const colorMap: Record<FilterKey, string> = {
                all: "text-accent",
                active: "text-emerald-600",
                inactive: "text-muted-foreground",
              };
              return (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl border p-3 sm:p-4 transition-all",
                    isSelected
                      ? "border-primary/30 bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/20 hover:bg-muted/50"
                  )}
                >
                  <opt.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", colorMap[opt.key])} />
                  <span className="text-xl sm:text-2xl font-bold tabular-nums leading-none">
                    {isLoading ? "—" : count}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{opt.label}</span>
                  {isSelected && (
                    <motion.div
                      layoutId="vehicle-filter-indicator"
                      className="absolute inset-0 rounded-xl ring-2 ring-primary/30"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, placa ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Vehicle list */}
          <Card>
            <div className="min-h-[300px]">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : filtered.length > 0 ? (
                <>
                  {/* Mobile: Cards */}
                  <div className="lg:hidden divide-y divide-border">
                    <AnimatePresence>
                      {filtered.map((vehicle) => (
                        <motion.div
                          key={vehicle.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="p-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                                vehicle.active
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Bus className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">{vehicle.name}</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0 shrink-0",
                                    vehicle.active
                                      ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {vehicle.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                {vehicle.plate && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="h-3 w-3" />
                                    {vehicle.plate}
                                  </span>
                                )}
                                {vehicle.model && (
                                  <span className="flex items-center gap-1 truncate">
                                    <CircleDot className="h-3 w-3 shrink-0" />
                                    {vehicle.model}
                                  </span>
                                )}
                                {vehicle.year && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {vehicle.year}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(vehicle)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive/70 hover:text-destructive"
                                onClick={() => setDeleteTarget(vehicle)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden lg:block">
                    <TooltipProvider>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[50px]" />
                            <TableHead>Nome</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Modelo</TableHead>
                            <TableHead className="text-center">Ano</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {filtered.map((vehicle) => (
                              <motion.tr
                                key={vehicle.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="border-b transition-colors hover:bg-muted/50"
                              >
                                <TableCell className="py-3">
                                  <div
                                    className={cn(
                                      "flex items-center justify-center w-9 h-9 rounded-lg",
                                      vehicle.active
                                        ? "bg-emerald-500/10 text-emerald-600"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    <Bus className="h-4 w-4" />
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold">{vehicle.name}</TableCell>
                                <TableCell>
                                  {vehicle.plate ? (
                                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{vehicle.plate}</span>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{vehicle.model || <span className="text-muted-foreground/50">—</span>}</TableCell>
                                <TableCell className="text-center tabular-nums">{vehicle.year || <span className="text-muted-foreground/50">—</span>}</TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      vehicle.active
                                        ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {vehicle.active ? "Ativo" : "Inativo"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(vehicle)}>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Editar</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive/70 hover:text-destructive"
                                          onClick={() => setDeleteTarget(vehicle)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Bus className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium text-muted-foreground">
                    {searchTerm ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {searchTerm
                      ? "Tente ajustar os termos de busca"
                      : "Clique em \"Novo veículo\" para começar"}
                  </p>
                  {!searchTerm && (
                    <Button size="sm" className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Novo veículo
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Result count footer */}
            {!isLoading && filtered.length > 0 && (
              <div className="border-t px-4 py-2.5">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.length} veículo{filtered.length !== 1 ? "s" : ""}
                  {filter !== "all" && ` (${FILTER_OPTIONS.find((f) => f.key === filter)?.label.toLowerCase()})`}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreate(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bus className="h-5 w-5 text-primary" />
                Novo veículo
              </DialogTitle>
              <DialogDescription>Adicione um veículo à frota.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input placeholder="Ex: Ônibus 01" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Placa</Label>
                  <Input placeholder="Ex: ABC1D23" value={plate} onChange={(e) => setPlate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input placeholder="Ex: 2019" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input placeholder="Ex: Mercedes OF-1721" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Ativo</p>
                  <p className="text-xs text-muted-foreground">Disponível para vínculos</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createVehicle.mutate()} disabled={createVehicle.isPending}>
                {createVehicle.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar veículo
              </DialogTitle>
              <DialogDescription>Atualize os dados do veículo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Placa</Label>
                  <Input value={editPlate} onChange={(e) => setEditPlate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input value={editYear} onChange={(e) => setEditYear(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={editModel} onChange={(e) => setEditModel(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Ativo</p>
                  <p className="text-xs text-muted-foreground">Disponível para vínculos</p>
                </div>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingVehicle(null)}>Cancelar</Button>
              <Button onClick={() => updateVehicle.mutate()} disabled={updateVehicle.isPending}>
                {updateVehicle.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir veículo?</DialogTitle>
              <DialogDescription>
                O veículo <strong>{deleteTarget?.name}</strong> será removido permanentemente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteVehicle.mutate(deleteTarget.id)}
                disabled={deleteVehicle.isPending}
              >
                {deleteVehicle.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </MainLayout>
  );
}
