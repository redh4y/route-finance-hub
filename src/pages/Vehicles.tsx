import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

type VehicleRecord = {
  id: string;
  name: string;
  plate: string | null;
  model: string | null;
  year: number | null;
  active: boolean;
  created_at: string;
};

export default function Vehicles() {
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [active, setActive] = useState(true);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editActive, setEditActive] = useState(true);

  const queryClient = useQueryClient();

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, name, plate, model, year, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VehicleRecord[];
    },
  });

  const createVehicle = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do veiculo");
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
      setName("");
      setPlate("");
      setModel("");
      setYear("");
      setActive(true);
      toast.success("Veiculo cadastrado");
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async () => {
      if (!editingVehicle) return;
      if (!editName.trim()) throw new Error("Informe o nome do veiculo");
      const parsedYear = editYear ? Number.parseInt(editYear, 10) : null;
      const { error } = await supabase
        .from("vehicles")
        .update({
          name: editName.trim(),
          plate: editPlate.trim() || null,
          model: editModel.trim() || null,
          year: Number.isNaN(parsedYear) ? null : parsedYear,
          active: editActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingVehicle.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setEditingVehicle(null);
      toast.success("Veiculo atualizado");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veiculo removido");
    },
    onError: (error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const openEdit = (vehicle: VehicleRecord) => {
    setEditingVehicle(vehicle);
    setEditName(vehicle.name);
    setEditPlate(vehicle.plate ?? "");
    setEditModel(vehicle.model ?? "");
    setEditYear(vehicle.year ? String(vehicle.year) : "");
    setEditActive(vehicle.active);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Veiculos</h1>
        <p className="page-subtitle">
          Cadastre veiculos para vincular gastos e acompanhar custos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Novo veiculo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Placa</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Disponivel para vinculos
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <Button
              className="w-full"
              onClick={() => createVehicle.mutate()}
              disabled={createVehicle.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar veiculo
            </Button>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Veiculos cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : vehicles && vehicles.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[90px]">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">{vehicle.name}</TableCell>
                        <TableCell>{vehicle.plate || "-"}</TableCell>
                        <TableCell>{vehicle.model || "-"}</TableCell>
                        <TableCell>{vehicle.year || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={vehicle.active ? "secondary" : "outline"}>
                            {vehicle.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="group"
                              onClick={() => openEdit(vehicle)}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="group">
                                  <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Excluir veiculo?</DialogTitle>
                                  <DialogDescription>
                                    Esta acao nao pode ser desfeita. O veiculo sera removido.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    onClick={() => deleteVehicle.mutate(vehicle.id)}
                                  >
                                    Excluir
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum veiculo cadastrado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar veiculo</DialogTitle>
            <DialogDescription>Atualize os dados do veiculo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Placa</Label>
              <Input value={editPlate} onChange={(e) => setEditPlate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input value={editModel} onChange={(e) => setEditModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input value={editYear} onChange={(e) => setEditYear(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Disponivel para vinculos
                </p>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVehicle(null)}>
              Cancelar
            </Button>
            <Button onClick={() => updateVehicle.mutate()} disabled={updateVehicle.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
